import {loadTensorflowModel, TensorflowModel, useTensorflowModel} from 'react-native-fast-tflite'
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode as atob } from 'base-64';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { decode as jpegDecode } from 'jpeg-js';

interface EmbeddingResult {
  embedding: number[];
}

let model: TensorflowModel | null = null;
const EMBEDDING_STORAGE_KEY = '@face_embedding:';

export function useFaceNetModel() {
  return useTensorflowModel(require('../assets/models/facenet_model(4).tflite'));
}

export function useFaceNetResize() {
  return useResizePlugin();
}

export async function loadFaceNetModel(): Promise<TensorflowModel> {
  if (model) return model;
  model = await loadTensorflowModel(require('../assets/models/facenet_model(4).tflite'));
  console.log('🤖 FaceNet model loaded');
  return model;
}

// THIS FUNCTION IS DEPRECATED as it's not reliable for getting the full embedding
export function processCameraFrameForFaceEmbedding(frame: any, model: TensorflowModel, resizeFunc: any): number {
  'worklet'
  if (!model) return 0;
  try {
    const resized = resizeFunc(frame, {
      scale: { width: 160, height: 160 },
      pixelFormat: 'rgb',
      dataType: 'float32',
    });
    const outputs = model.runSync([resized]);
    if (!outputs || outputs.length === 0) return 0;
    const embedding = outputs[0] as Float32Array;
    return embedding.length;
  } catch (error) {
    console.error('💥 Error in camera frame processing:', error);
    return 0;
  }
}


// --- NEW AND CORRECTED preProcessImage FUNCTION ---
/**
 * Correctly preprocesses an image URI by decoding it into a raw pixel buffer
 * and normalizing it for the FaceNet model.
 * @param uri The URI of the image to process (e.g., 'file:///...').
 */
async function preprocessImage(uri: string): Promise<Float32Array> {
  try {
    console.log(`📸 Correctly preprocessing image: ${uri}`);
    
    // 1. Resize image to 160x160 and get it as a JPEG base64 string.
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 160, height: 160 } }],
      { format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (!manipResult.base64) {
      throw new Error('Failed to get base64 from manipulated image');
    }

    // 2. Convert the base64 string to a Uint8Array buffer that jpeg-js can read.
    const binaryString = atob(manipResult.base64);
    const len = binaryString.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }

    // 3. Decode the JPEG buffer to get the raw pixel data.
    const rawImageData = jpegDecode(buffer, { useTArray: true });
    // rawImageData.data is a Uint8Array of [R, G, B, A, R, G, B, A, ...]
    const pixelData = rawImageData.data;

    // 4. Create a Float32Array and normalize the pixel data to the [-1, 1] range.
    const floatData = new Float32Array(160 * 160 * 3);
    for (let i = 0; i < 160 * 160; i++) {
      const r = pixelData[i * 4];
      const g = pixelData[i * 4 + 1];
      const b = pixelData[i * 4 + 2];
      // Alpha channel (pixelData[i * 4 + 3]) is ignored.
      
      floatData[i * 3]     = (r / 127.5) - 1.0;
      floatData[i * 3 + 1] = (g / 127.5) - 1.0;
      floatData[i * 3 + 2] = (b / 127.5) - 1.0;
    }
    
    console.log(`✅ Image decoded and normalized successfully.`);
    console.log(`📊 Normalizing buffer. Sample values: [${floatData[0].toFixed(3)}, ${floatData[1].toFixed(3)}, ${floatData[2].toFixed(3)}]`);

    return floatData;
    
  } catch (error) {
    console.error('💥 Error in preprocessImage:', error);
    throw new Error('Image preprocessing failed.');
  }
}


/**
 * Runs FaceNet model and returns embedding. Uses the CORRECTED preprocessImage.
 */
export async function getFaceEmbedding(imageUri: string): Promise<EmbeddingResult> {
  try {
    const m = await loadFaceNetModel();
    const input = await preprocessImage(imageUri);
    
    if (input.length !== 160 * 160 * 3) {
      throw new Error(`Invalid input size: ${input.length}`);
    }
    
    const outputs = await m.run([input]);

    if (!outputs || outputs.length === 0) {
      throw new Error('Model returned no outputs');
    }

    const embedding = Array.from(outputs[0] as Float32Array);
    console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
    return { embedding };
    
  } catch (error) {
    console.error('💥 Error in getFaceEmbedding:', error);
    throw new Error(`Face embedding generation failed.`);
  }
}

export function compareEmbeddings(emb1: number[], emb2: number[]): number {
  const dot = emb1.reduce((sum, a, i) => sum + a * emb2[i], 0);
  const normA = Math.sqrt(emb1.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(emb2.reduce((sum, b) => sum + b * b, 0));
  const similarity = dot / (normA * normB);
  console.log(`🤝 Similarity score: ${similarity.toFixed(4)}`);
  return similarity;
}

export async function saveEmbedding(userId: string, embedding: number[]): Promise<void> {
  try {
    const key = `${EMBEDDING_STORAGE_KEY}${userId}`;
    const jsonValue = JSON.stringify(embedding);
    await AsyncStorage.setItem(key, jsonValue);
    console.log(`💾 Embedding for user "${userId}" saved successfully.`);
  } catch (e) {
    console.error('💥 Failed to save embedding to storage:', e);
    throw new Error('Failed to save face data.');
  }
}

export async function loadEmbedding(userId: string): Promise<number[] | null> {
  try {
    const key = `${EMBEDDING_STORAGE_KEY}${userId}`;
    const jsonValue = await AsyncStorage.getItem(key);
    if (jsonValue != null) {
      console.log(`✅ Embedding for user "${userId}" loaded successfully.`);
      return JSON.parse(jsonValue) as number[];
    } else {
      console.log(`🤷 No embedding found for user "${userId}".`);
      return null;
    }
  } catch (e) {
    console.error('💥 Failed to load embedding from storage:', e);
    throw new Error('Failed to load face data.');
  }
}

export const loadRegisteredUser = async () => {
    try {
      // Get the single registered user from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const embeddingKey = allKeys.find(key => key.startsWith('@face_embedding:'));
      
      if (embeddingKey) {
        const userId = embeddingKey.replace('@face_embedding:', '');
        setRegisteredUser(userId);
        console.log(`📋 Registered user found: ${userId}`);
      } else {
        console.log('📋 No registered user found');
        setRegisteredUser(null);
      }
    } catch (error) {
      console.error('💥 Error loading registered user:', error);
    }
  };

