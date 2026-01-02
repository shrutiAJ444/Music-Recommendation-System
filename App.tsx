import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MoodInput } from './components/MoodInput';
import { PlaylistDisplay } from './components/PlaylistDisplay';
import { ContextProvider } from './components/ContextProvider';
import { analyzeFacialEmotion, getPlaylistRecommendation, analyzeTextEmotion, analyzeVocalEmotion } from './services/geminiService';
import { fetchWeatherByLocation } from './services/weatherService';
import { Emotion, Song, Platform, Weather, InputMode } from './types';

const App: React.FC = () => {
  const [step, setStep] = useState<'input' | 'analyzing' | 'result'>('input');
  const [inputMode, setInputMode] = useState<InputMode>('camera');
  const [detectedEmotion, setDetectedEmotion] = useState<Emotion | null>(null);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [feedbackHistory, setFeedbackHistory] = useState<{ liked: Song[], disliked: Song[] }>(() => {
    try {
      const storedFeedback = localStorage.getItem('meloMoodFeedback');
      return storedFeedback ? JSON.parse(storedFeedback) : { liked: [], disliked: [] };
    } catch (err) {
      console.error("Could not parse feedback history from localStorage", err);
      return { liked: [], disliked: [] };
    }
  });

  const [platform, setPlatform] = useState<Platform>('Spotify');
  const [weather, setWeather] = useState<Weather>('Sunny');
  const [timeOfDay, setTimeOfDay] = useState<string>('Morning');

  const [isWeatherAuto, setIsWeatherAuto] = useState<boolean>(true);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const handleFetchWeather = useCallback(async () => {
    setIsWeatherLoading(true);
    setWeatherError(null);
    setIsWeatherAuto(true);
    try {
      const detectedWeather = await fetchWeatherByLocation();
      setWeather(detectedWeather);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setWeatherError(errorMessage);
      setIsWeatherAuto(false); // Fallback to manual
    } finally {
      setIsWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    const updateTimeOfDay = () => {
      const hour = new Date().getHours();
      if (hour < 12) setTimeOfDay('Morning');
      else if (hour < 18) setTimeOfDay('Afternoon');
      else setTimeOfDay('Evening');
    };

    updateTimeOfDay();
    handleFetchWeather();
    const timerId = setInterval(updateTimeOfDay, 1000 * 60 * 60);
    return () => clearInterval(timerId);
  }, [handleFetchWeather]);

  useEffect(() => {
    try {
      localStorage.setItem('meloMoodFeedback', JSON.stringify(feedbackHistory));
    } catch (err) {
      console.error("Could not save feedback history to localStorage", err);
    }
  }, [feedbackHistory]);

  const handleReset = () => {
    setStep('input');
    setDetectedEmotion(null);
    setPlaylist([]);
    setError(null);
    setSearchQuery('');
  };

  const handleClearFeedback = () => {
    setFeedbackHistory({ liked: [], disliked: [] });
  };
  
  const handleAnalysis = useCallback(async (data: string) => {
    setStep('analyzing');
    setError(null);
    setPlaylist([]);

    try {
      let emotionResult: { emotion: Emotion; confidence: number } | null = null;
      if (inputMode === 'camera') {
        emotionResult = await analyzeFacialEmotion(data);
      } else if (inputMode === 'text') {
        const emotion = await analyzeTextEmotion(data);
        emotionResult = { emotion, confidence: 0.9 }; // Assume high confidence for text
      } else if (inputMode === 'voice') {
        const emotion = await analyzeVocalEmotion(data); // data is the vocal description
        emotionResult = { emotion, confidence: 0.8 }; // Assume slightly lower confidence than text
      }

      if (!emotionResult || (inputMode === 'camera' && emotionResult.confidence < 0.6)) {
        setError("Could not confidently detect an emotion. Please try again with better lighting, or describe your mood in text.");
        setStep('input');
        return;
      }

      setDetectedEmotion(emotionResult.emotion);

      const context = {
        platform,
        weather,
        timeOfDay,
        feedbackHistory,
      };

      const recommendedPlaylist = await getPlaylistRecommendation(emotionResult.emotion, context);
      setPlaylist(recommendedPlaylist);
      setStep('result');

    } catch (e) {
      console.error(e);
      setError("An error occurred while generating your playlist. Please try again.");
      setStep('input');
    }
  }, [inputMode, platform, weather, timeOfDay, feedbackHistory]);

  const handleFeedback = (song: Song, type: 'like' | 'dislike') => {
    setFeedbackHistory(prev => {
      const newHistory = { 
        liked: [...prev.liked],
        disliked: [...prev.disliked]
      };
      const isLiked = prev.liked.some(s => s.title === song.title && s.artist === song.artist);
      const isDisliked = prev.disliked.some(s => s.title === song.title && s.artist === song.artist);

      if (type === 'like') {
        newHistory.disliked = newHistory.disliked.filter(s => s.title !== song.title || s.artist !== song.artist);
        if (isLiked) {
          newHistory.liked = newHistory.liked.filter(s => s.title !== song.title || s.artist !== song.artist);
        } else {
          newHistory.liked.push(song);
        }
      } else { // type === 'dislike'
        newHistory.liked = newHistory.liked.filter(s => s.title !== song.title || s.artist !== song.artist);
        if (isDisliked) {
          newHistory.disliked = newHistory.disliked.filter(s => s.title !== song.title || s.artist !== song.artist);
        } else {
          newHistory.disliked.push(song);
        }
      }
      return newHistory;
    });
  };

  const handleSetWeatherManually = (newWeather: Weather) => {
    setWeather(newWeather);
    setIsWeatherAuto(false);
  };

  const switchToManualWeather = () => {
    setIsWeatherAuto(false);
  };

  const renderContent = () => {
    switch (step) {
      case 'input':
        return <MoodInput onAnalyze={handleAnalysis} error={error} mode={inputMode} setMode={setInputMode} />;
      case 'analyzing':
        return (
          <div className="flex flex-col items-center justify-center text-white p-8 space-y-4">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-purple-400"></div>
            <p className="text-lg font-medium">Analyzing your mood...</p>
            <p className="text-sm text-gray-400">Crafting the perfect vibe, just for you.</p>
          </div>
        );
      case 'result':
        return <PlaylistDisplay 
                  emotion={detectedEmotion} 
                  playlist={playlist} 
                  onReset={handleReset}
                  onFeedback={handleFeedback}
                  platform={platform} 
                  feedbackHistory={feedbackHistory}
                  searchQuery={searchQuery}
                  onClearFeedback={handleClearFeedback} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white font-sans flex flex-col items-center p-4 selection:bg-purple-500 selection:text-white">
      <div className="w-full max-w-2xl mx-auto">
        <Header step={step} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <main className="mt-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/20 border border-gray-700 overflow-hidden">
            {step !== 'result' && (
              <ContextProvider 
                platform={platform} setPlatform={setPlatform}
                weather={weather} setWeather={handleSetWeatherManually}
                timeOfDay={timeOfDay} 
                isWeatherAuto={isWeatherAuto}
                isWeatherLoading={isWeatherLoading}
                weatherError={weatherError}
                onFetchWeather={handleFetchWeather}
                switchToManualWeather={switchToManualWeather}
              />
            )}
            <div className="p-2">
              {renderContent()}
            </div>
          </div>
          <footer className="text-center mt-8 text-gray-500 text-xs">
            <p>Privacy First: Your images are processed in memory and never stored.</p>
            <p>&copy; {new Date().getFullYear()} MeloMood. All rights reserved.</p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;