import { EmotionState } from '@/context/AppContext';

const emotionKeywords: Record<string, string[]> = {
  calm: ['peaceful', 'relaxed', 'content', 'okay', 'fine', 'good', 'happy', 'great', 'wonderful'],
  'mild stress': ['worried', 'concerned', 'nervous', 'uneasy', 'tense', 'pressure', 'busy', 'tired'],
  'moderate anxiety': ['anxious', 'panic', 'fear', 'scared', 'overwhelmed', 'cant breathe', 'racing', 'restless', 'dread'],
  'severe depression': ['hopeless', 'worthless', 'empty', 'numb', 'dark', 'nothing matters', 'give up', 'alone', 'meaningless'],
  burnout: ['exhausted', 'burned out', 'cant anymore', 'drained', 'depleted', 'overworked', 'no energy'],
};

const distortionPatterns: Record<string, string[]> = {
  rumination: ['keep thinking', 'cant stop thinking', 'over and over', 'replay', 'stuck in my head', 'always on my mind'],
  'self-blame': ['my fault', 'i caused', 'blame myself', 'i should have', 'i failed', 'im the problem'],
  hopelessness: ['never get better', 'no point', 'nothing will change', 'whats the point', 'give up', 'no future'],
  overthinking: ['analyzing everything', 'what if', 'cant decide', 'too many thoughts', 'spiral', 'second guess'],
};

export function analyzeEmotion(text: string): EmotionState {
  const lower = text.toLowerCase();
  
  let bestEmotion = 'calm';
  let bestScore = 0;
  
  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestEmotion = emotion;
    }
  }

  const detectedDistortions: string[] = [];
  for (const [distortion, patterns] of Object.entries(distortionPatterns)) {
    if (patterns.some(p => lower.includes(p))) {
      detectedDistortions.push(distortion);
    }
  }

  const negativeWords = ['not', 'never', 'cant', 'dont', 'wont', 'hate', 'bad', 'worse', 'worst', 'terrible', 'awful'];
  const positiveWords = ['love', 'good', 'great', 'happy', 'better', 'best', 'wonderful', 'amazing', 'hope'];
  const negCount = negativeWords.filter(w => lower.includes(w)).length;
  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const sentiment = Math.max(-1, Math.min(1, (posCount - negCount) / Math.max(1, posCount + negCount)));

  const intensityMap: Record<string, number> = {
    calm: 0.2,
    'mild stress': 0.4,
    'moderate anxiety': 0.65,
    'severe depression': 0.9,
    burnout: 0.8,
  };

  return {
    primary: bestEmotion,
    intensity: intensityMap[bestEmotion] || 0.3,
    distortions: detectedDistortions,
    sentiment,
  };
}

export function generateInsight(emotion: EmotionState): string {
  const insights: Record<string, string[]> = {
    calm: [
      "You seem to be in a balanced emotional state. This is a great foundation for deeper self-exploration.",
      "Your emotional baseline appears stable. Let's explore what maintains this equilibrium.",
    ],
    'mild stress': [
      "You may be experiencing mild stress. This is often related to external pressures and uncertainty.",
      "I'm noticing signs of tension in your expression. Identifying the source can help us address it together.",
    ],
    'moderate anxiety': [
      "You may be experiencing moderate anxiety related to uncertainty and overthinking. This is more common than you might think.",
      "Your responses suggest elevated anxiety levels. Let's work on grounding techniques together.",
    ],
    'severe depression': [
      "I'm sensing deep emotional pain in your words. Please know that seeking help is a sign of incredible strength.",
      "Your feelings are valid and important. Let's explore these emotions in a safe space together.",
    ],
    burnout: [
      "You may be experiencing burnout — a state of chronic stress that has led to exhaustion. Recovery is absolutely possible.",
      "Your energy reserves seem depleted. Let's focus on restoration and boundary-setting strategies.",
    ],
  };

  const pool = insights[emotion.primary] || insights.calm;
  const base = pool[Math.floor(Math.random() * pool.length)];

  if (emotion.distortions.length > 0) {
    return `${base} I've also noticed patterns of ${emotion.distortions.join(' and ')}, which we can work through together.`;
  }
  return base;
}

export function generateRecommendations(emotion: EmotionState): string[] {
  const base = [
    "Practice 4-7-8 breathing: Inhale for 4 seconds, hold for 7, exhale for 8.",
    "Try journaling for 10 minutes about what you're grateful for today.",
  ];

  const specific: Record<string, string[]> = {
    'mild stress': [
      "Take a 20-minute walk in nature to reset your stress response.",
      "Try progressive muscle relaxation before bed tonight.",
      "Set clear boundaries between work and personal time.",
    ],
    'moderate anxiety': [
      "Practice the 5-4-3-2-1 grounding technique: Name 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste.",
      "Consider a body scan meditation — start from your toes and work up.",
      "Challenge anxious thoughts: What evidence supports or contradicts this worry?",
      "Limit caffeine intake, especially in the afternoon.",
    ],
    'severe depression': [
      "Reach out to someone you trust today, even with a simple message.",
      "Set one small, achievable goal for tomorrow.",
      "Consider speaking with a licensed mental health professional.",
      "Engage in one activity that used to bring you joy, even briefly.",
    ],
    burnout: [
      "Schedule deliberate rest periods — not just 'time off' but true recovery.",
      "Identify and eliminate one unnecessary commitment this week.",
      "Practice saying 'no' to new requests until your energy recovers.",
      "Prioritize sleep hygiene: consistent schedule, dark room, no screens.",
    ],
  };

  return [...base, ...(specific[emotion.primary] || [])];
}

export function detectCrisis(text: string): boolean {
  const crisisKeywords = [
    'suicide', 'kill myself', 'end it all', 'want to die', 'no reason to live',
    'better off dead', 'self harm', 'hurt myself', 'end my life',
  ];
  const lower = text.toLowerCase();
  return crisisKeywords.some(k => lower.includes(k));
}
