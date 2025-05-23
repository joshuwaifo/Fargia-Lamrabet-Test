export interface VoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
  voice?: SpeechSynthesisVoice;
}

export const defaultVoiceSettings: VoiceSettings = {
  rate: 0.9,
  pitch: 1.1,
  volume: 0.8,
};

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  
  return window.speechSynthesis.getVoices();
}

export function findBestVoice(preferFemale: boolean = true): SpeechSynthesisVoice | undefined {
  const voices = getAvailableVoices();
  
  if (voices.length === 0) {
    return undefined;
  }

  // Try to find a high-quality English voice
  const englishVoices = voices.filter(voice => 
    voice.lang.startsWith('en-') && voice.localService
  );

  if (englishVoices.length === 0) {
    return voices[0]; // Fallback to first available voice
  }

  // Look for female voices if preferred
  if (preferFemale) {
    const femaleVoices = englishVoices.filter(voice =>
      voice.name.toLowerCase().includes('female') ||
      voice.name.toLowerCase().includes('woman') ||
      voice.name.toLowerCase().includes('samantha') ||
      voice.name.toLowerCase().includes('alex') ||
      voice.name.toLowerCase().includes('victoria')
    );
    
    if (femaleVoices.length > 0) {
      return femaleVoices[0];
    }
  }

  return englishVoices[0];
}

export function speakText(
  text: string, 
  settings: Partial<VoiceSettings> = {},
  onStart?: () => void,
  onEnd?: () => void
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const finalSettings = { ...defaultVoiceSettings, ...settings };
  const utterance = new SpeechSynthesisUtterance(text);

  utterance.rate = finalSettings.rate;
  utterance.pitch = finalSettings.pitch;
  utterance.volume = finalSettings.volume;

  if (finalSettings.voice) {
    utterance.voice = finalSettings.voice;
  } else {
    const bestVoice = findBestVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
    }
  }

  utterance.onstart = () => {
    onStart?.();
  };

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = (event) => {
    console.error('Speech synthesis error:', event);
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  
  return window.speechSynthesis.speaking;
}
