export type Emotion = 'Happy' | 'Sad' | 'Angry' | 'Fear' | 'Surprise' | 'Excited' | 'Neutral' | 'Calm' | 'Content' | 'Energetic' | 'Thoughtful';

export const EMOTIONS: Emotion[] = ['Happy', 'Sad', 'Angry', 'Fear', 'Surprise', 'Excited', 'Neutral', 'Calm', 'Content', 'Energetic', 'Thoughtful'];

export interface Song {
  title: string;
  artist: string;
  album: string;
}

export type Platform = 'Spotify' | 'YouTube Music' | 'Apple Music';
export const PLATFORMS: Platform[] = ['Spotify', 'YouTube Music', 'Apple Music'];

export type Weather = 'Sunny' | 'Cloudy' | 'Rainy' | 'Snowy';
export const WEATHER_OPTIONS: Weather[] = ['Sunny', 'Cloudy', 'Rainy', 'Snowy'];

export type InputMode = 'camera' | 'text' | 'voice';