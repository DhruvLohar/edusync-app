import { useState, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';

export const useAudio = (source: any) => {
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    useEffect(() => {
        let isMounted = true;
        let soundObject: Audio.Sound | null = null;

        const loadSound = async () => {
            try {
                const { sound } = await Audio.Sound.createAsync(source);
                if (isMounted) {
                    soundObject = sound;
                    setSound(sound);
                }
            } catch (error) {
                console.error('Error loading sound', error);
            }
        };

        loadSound();

        return () => {
            isMounted = false;
            if (soundObject) {
                soundObject.unloadAsync();
            }
        };
    }, [source]);

    const play = useCallback(async () => {
        if (sound) {
            try {
                // replayAsync ensures it plays from the start every time
                await sound.replayAsync();
            } catch (error) {
                console.error('Error playing sound', error);
            }
        }
    }, [sound]);

    return { play };
};