import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Code2, 
  Box, 
  Rocket, 
  TestTube2, 
  LineChart, 
  Activity, 
  Mic, 
  Database,
  ChevronDown,
  ChevronLeft,
  Sparkles,
  MessageSquare,
  Network,
  Check,
  Info,
  AlertCircle,
  Loader2,
  Server,
  MessageCircle,
  Link,
  Settings,
  ShieldCheck,
  GitMerge,
  Layers,
  Trash2,
  MoreVertical,
  ExternalLink,
  Clock,
  Maximize2,
  Square,
  RotateCcw,
  Play
} from 'lucide-react';
import { SiOpenai } from 'react-icons/si';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRemoteParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { ConnectionState, ParticipantEvent, RoomEvent, Track } from 'livekit-client';
import { fetchConnectionDetails } from './lib/connection';
import './Devant.css';

const LiveKitIcon = ({ size = 24, color = 'currentColor' }: { size?: number, color?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill={color} 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0l12 6.928v10.144L12 24 0 17.072V6.928L12 0zm0 2.227L2.146 7.915v8.17L12 21.773l9.854-5.688v-8.17L12 2.227zM12 18.06l-5.32-3.07v-6.14l5.32-3.07 5.32 3.07v6.14l-5.32 3.07z"/>
  </svg>
);

const LiveKitLogo = ({ size = 24, color = '#111827' }: { size?: number, color?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M14.4004 9.59961H9.59961V14.4004H14.4004V9.59961Z" fill="#1FD5F9"/>
    <path d="M19.2011 4.80078H14.4004V9.60153H19.2011V4.80078Z" fill="#1FD5F9"/>
    <path d="M19.2011 14.4004H14.4004V19.2011H19.2011V14.4004Z" fill="#1FD5F9"/>
    <path d="M24 0H19.1992V4.80075H24V0Z" fill="#1FD5F9"/>
    <path d="M24 19.1992H19.1992V24H24V19.1992Z" fill="#1FD5F9"/>
    <path d="M4.80075 19.1992V14.4004V9.59962V4.80075V0H0V4.80075V9.59962V14.4004V19.1992V24H4.80075H9.59963H14.4004V19.1992H9.59963H4.80075Z" fill={color}/>
  </svg>
);

const STT_PROVIDERS: Record<string, { models: {id: string, label: string}[], languages: {code: string, label: string}[] }> = {
  deepgram: {
    models: [
      { id: 'deepgram/nova-3-general', label: 'Nova-3 (Monolingual, 45 langs)' },
      { id: 'deepgram/nova-3-medical', label: 'Nova-3 Medical (English)' },
      { id: 'deepgram/nova-3-multilingual', label: 'Nova-3 (Multilingual)' },
      { id: 'deepgram/nova-2-general', label: 'Nova-2 (Multilingual, 33 langs)' },
      { id: 'deepgram/nova-2-conversationalai', label: 'Nova-2 Conversational AI (English)' },
      { id: 'deepgram/nova-2-medical', label: 'Nova-2 Medical (English)' },
      { id: 'deepgram/nova-2-phonecall', label: 'Nova-2 Phone Call (English)' },
      { id: 'deepgram/flux-general', label: 'Flux (English)' },
      { id: 'deepgram/flux-multilingual', label: 'Flux (Multilingual, 10 langs)' },
    ],
    languages: [
      { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' }, { code: 'es', label: 'Spanish' },
      { code: 'fr', label: 'French' }, { code: 'de', label: 'German' }, { code: 'it', label: 'Italian' },
      { code: 'pt', label: 'Portuguese' }, { code: 'ja', label: 'Japanese' }, { code: 'ko', label: 'Korean' },
      { code: 'zh', label: 'Chinese' }, { code: 'multi', label: 'Multilingual (auto-detect)' },
    ],
  },
  assemblyai: {
    models: [
      { id: 'assemblyai/u3-rt-pro', label: 'Universal-3 Pro Streaming (6 langs)' },
      { id: 'assemblyai/universal-streaming', label: 'Universal Streaming (English)' },
      { id: 'assemblyai/universal-streaming-multilingual', label: 'Universal Streaming Multilingual (6 langs)' },
    ],
    languages: [
      { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }, { code: 'de', label: 'German' },
      { code: 'fr', label: 'French' }, { code: 'pt', label: 'Portuguese' }, { code: 'it', label: 'Italian' },
    ],
  },
  cartesia: {
    models: [{ id: 'cartesia/ink-whisper', label: 'Ink Whisper (100 languages)' }],
    languages: [
      { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
      { code: 'de', label: 'German' }, { code: 'ja', label: 'Japanese' }, { code: 'zh', label: 'Chinese' },
      { code: 'hi', label: 'Hindi' }, { code: 'ko', label: 'Korean' }, { code: 'pt', label: 'Portuguese' },
      { code: 'it', label: 'Italian' }, { code: 'multi', label: 'Other (100+ langs)' },
    ],
  },
  elevenlabs: {
    models: [{ id: 'elevenlabs/scribe_v2_realtime', label: 'Scribe v2 Realtime (190 languages)' }],
    languages: [
      { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
      { code: 'de', label: 'German' }, { code: 'ja', label: 'Japanese' }, { code: 'zh', label: 'Chinese' },
      { code: 'hi', label: 'Hindi' }, { code: 'ko', label: 'Korean' }, { code: 'pt', label: 'Portuguese' },
      { code: 'it', label: 'Italian' }, { code: 'multi', label: 'Multilingual (190+ langs)' },
    ],
  },
  xai: {
    models: [{ id: 'xai/stt-1', label: 'Speech to Text (25 languages)' }],
    languages: [
      { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
      { code: 'de', label: 'German' }, { code: 'ja', label: 'Japanese' }, { code: 'zh', label: 'Chinese' },
      { code: 'hi', label: 'Hindi' }, { code: 'ko', label: 'Korean' }, { code: 'ar', label: 'Arabic' },
      { code: 'ru', label: 'Russian' }, { code: 'tr', label: 'Turkish' }, { code: 'vi', label: 'Vietnamese' },
      { code: 'id', label: 'Indonesian' }, { code: 'pt', label: 'Portuguese' }, { code: 'it', label: 'Italian' },
    ],
  },
};

const TTS_PROVIDERS: Record<string, { models: {id: string, label: string}[], voices: {id: string, label: string}[], languages: {code: string, label: string}[] }> = {
  cartesia: {
    models: [
      { id: 'cartesia/sonic-3', label: 'Sonic 3' },
      { id: 'cartesia/sonic-3-2025-10-27', label: 'Sonic 3 (2025-10-27)' },
      { id: 'cartesia/sonic-3-2026-01-12', label: 'Sonic 3 (2026-01-12)' },
      { id: 'cartesia/sonic-2', label: 'Sonic 2' },
      { id: 'cartesia/sonic', label: 'Sonic' },
      { id: 'cartesia/sonic-turbo', label: 'Sonic Turbo' },
    ],
    voices: [
      { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', label: 'Blake' },
      { id: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', label: 'Daniela' },
      { id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', label: 'Jacqueline' },
      { id: 'f31cc6a7-c1e8-4764-980c-60a361443dd1', label: 'Robyn' },
      { id: 'custom', label: 'Other (Custom ID)' },
    ],
    languages: [
      { code: 'en', label: 'English' }, { code: 'fr', label: 'French' }, { code: 'de', label: 'German' },
      { code: 'es', label: 'Spanish' }, { code: 'pt', label: 'Portuguese' }, { code: 'zh', label: 'Chinese' },
      { code: 'ja', label: 'Japanese' }, { code: 'hi', label: 'Hindi' }, { code: 'it', label: 'Italian' },
      { code: 'ko', label: 'Korean' }, { code: 'nl', label: 'Dutch' }, { code: 'pl', label: 'Polish' },
      { code: 'ru', label: 'Russian' }, { code: 'sv', label: 'Swedish' }, { code: 'tr', label: 'Turkish' },
    ],
  },
  elevenlabs: {
    models: [
      { id: 'elevenlabs/eleven_flash_v2_5', label: 'Flash v2.5' },
      { id: 'elevenlabs/eleven_flash_v2', label: 'Flash v2 (English)' },
      { id: 'elevenlabs/eleven_turbo_v2_5', label: 'Turbo v2.5' },
      { id: 'elevenlabs/eleven_turbo_v2', label: 'Turbo v2 (English)' },
      { id: 'elevenlabs/eleven_multilingual_v2', label: 'Multilingual v2' },
      { id: 'elevenlabs/eleven_v3', label: 'Eleven v3' },
    ],
    voices: [
      { id: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice' },
      { id: 'iP95p4xoKVk53GoZ742B', label: 'Chris' },
      { id: 'cjVigY5qzO86Huf0OWal', label: 'Eric' },
      { id: 'cgSgspJ2msm6clMCkdW9', label: 'Jessica' },
      { id: 'custom', label: 'Other (Custom ID)' },
    ],
    languages: [
      { code: 'en', label: 'English' }, { code: 'ja', label: 'Japanese' }, { code: 'zh', label: 'Chinese' },
      { code: 'de', label: 'German' }, { code: 'hi', label: 'Hindi' }, { code: 'fr', label: 'French' },
      { code: 'ko', label: 'Korean' }, { code: 'pt', label: 'Portuguese' }, { code: 'it', label: 'Italian' },
      { code: 'es', label: 'Spanish' }, { code: 'id', label: 'Indonesian' }, { code: 'nl', label: 'Dutch' },
      { code: 'tr', label: 'Turkish' }, { code: 'pl', label: 'Polish' }, { code: 'sv', label: 'Swedish' },
      { code: 'ru', label: 'Russian' }, { code: 'vi', label: 'Vietnamese' }, { code: 'ar', label: 'Arabic' },
    ],
  },
  deepgram: {
    models: [
      { id: 'deepgram/aura-2', label: 'Aura 2' },
      { id: 'deepgram/aura', label: 'Aura' },
    ],
    voices: [
      { id: 'apollo', label: 'Apollo (Male)' },
      { id: 'athena', label: 'Athena (Female)' },
      { id: 'odysseus', label: 'Odysseus (Male)' },
      { id: 'theia', label: 'Theia (Female)' },
      { id: 'custom', label: 'Other (Custom Name)' },
    ],
    languages: [
      { code: 'en', label: 'English' }, { code: 'en-US', label: 'English (US)' },
      { code: 'en-GB', label: 'English (UK)' }, { code: 'en-AU', label: 'English (AU)' },
      { code: 'en-PH', label: 'English (PH)' }, { code: 'es', label: 'Spanish' },
      { code: 'es-MX', label: 'Spanish (MX)' }, { code: 'fr', label: 'French' },
      { code: 'de', label: 'German' }, { code: 'it', label: 'Italian' },
      { code: 'ja', label: 'Japanese' }, { code: 'nl', label: 'Dutch' },
    ],
  },
  inworld: {
    models: [
      { id: 'inworld/inworld-tts-1', label: 'Inworld TTS 1' },
      { id: 'inworld/inworld-tts-1-max', label: 'Inworld TTS 1 Max' },
      { id: 'inworld/inworld-tts-1.5-max', label: 'Inworld TTS 1.5 Max' },
      { id: 'inworld/inworld-tts-1.5-mini', label: 'Inworld TTS 1.5 Mini' },
    ],
    voices: [
      { id: 'Ashley', label: 'Ashley (Female)' },
      { id: 'Diego', label: 'Diego (Male)' },
      { id: 'Edward', label: 'Edward (Male)' },
      { id: 'Olivia', label: 'Olivia (Female)' },
      { id: 'custom', label: 'Other (Custom Name)' },
    ],
    languages: [
      { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
      { code: 'ko', label: 'Korean' }, { code: 'nl', label: 'Dutch' }, { code: 'zh', label: 'Chinese' },
      { code: 'de', label: 'German' }, { code: 'it', label: 'Italian' }, { code: 'ja', label: 'Japanese' },
      { code: 'pl', label: 'Polish' }, { code: 'pt', label: 'Portuguese' }, { code: 'ru', label: 'Russian' },
      { code: 'hi', label: 'Hindi' }, { code: 'he', label: 'Hebrew' }, { code: 'ar', label: 'Arabic' },
    ],
  },
  rime: {
    models: [
      { id: 'rime/arcana', label: 'Arcana (en, es, fr, de, hi, he, ja, pt, ar)' },
      { id: 'rime/mistv3', label: 'Mist v3 (en, es, fr, de, hi)' },
      { id: 'rime/mistv2', label: 'Mist v2 (en, es, fr, de)' },
      { id: 'rime/mist', label: 'Mist (English)' },
    ],
    voices: [
      { id: 'astra', label: 'Astra' },
      { id: 'celeste', label: 'Celeste' },
      { id: 'luna', label: 'Luna' },
      { id: 'ursa', label: 'Ursa' },
      { id: 'custom', label: 'Other (Custom Name)' },
    ],
    languages: [
      { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
      { code: 'de', label: 'German' }, { code: 'hi', label: 'Hindi' }, { code: 'he', label: 'Hebrew' },
      { code: 'ja', label: 'Japanese' }, { code: 'pt', label: 'Portuguese' }, { code: 'ar', label: 'Arabic' },
    ],
  },
  xai: {
    models: [{ id: 'xai/tts-1', label: 'xAI TTS 1' }],
    voices: [
      { id: 'ara', label: 'Ara' },
      { id: 'eve', label: 'Eve' },
      { id: 'leo', label: 'Leo' },
      { id: 'rex', label: 'Rex' },
      { id: 'custom', label: 'Other (Custom Name)' },
    ],
    languages: [
      { code: 'auto', label: 'Auto-detect' }, { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish (MX/ES)' },
      { code: 'fr', label: 'French' }, { code: 'de', label: 'German' }, { code: 'ja', label: 'Japanese' },
      { code: 'zh', label: 'Chinese' }, { code: 'hi', label: 'Hindi' }, { code: 'ko', label: 'Korean' },
      { code: 'ar', label: 'Arabic' }, { code: 'ru', label: 'Russian' }, { code: 'pt', label: 'Portuguese' },
      { code: 'vi', label: 'Vietnamese' }, { code: 'tr', label: 'Turkish' }, { code: 'id', label: 'Indonesian' },
    ],
  },
};

const CollapsibleSection = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc', marginBottom: '24px' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </div>
        <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#64748b' }} />
      </div>
      {isOpen && (
        <div style={{ marginTop: '20px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default function Devant() {
  const [setupStep, setSetupStep] = useState(1);
  const [sttModel, setSttModel] = useState<string>('deepgram');
  const [ttsModel, setTtsModel] = useState<string>('cartesia');
  const [isAdminExpanded, setIsAdminExpanded] = useState(true);
  const [view, setView] = useState<'list' | 'setup' | 'details'>('setup');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [activeDetailTab, setActiveDetailTab] = useState('Overview');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('default');
  const [customVoiceId, setCustomVoiceId] = useState<string>('');
  const [configSttProvider, setConfigSttProvider] = useState<string>('deepgram');
  const [configSttModel, setConfigSttModel] = useState<string>('deepgram/nova-3-general');
  const [configSttLang, setConfigSttLang] = useState<string>('en');
  const [configTtsProvider, setConfigTtsProvider] = useState<string>('cartesia');
  const [configTtsModel, setConfigTtsModel] = useState<string>('cartesia/sonic-3');
  const [configTtsLang, setConfigTtsLang] = useState<string>('en');
  const [activeLogTab, setActiveLogTab] = useState<'Voice Pipeline' | 'Agent'>('Voice Pipeline');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Pipeline Settings
  const [turnDetectionEnabled, setTurnDetectionEnabled] = useState(true);
  const [turnDetectionMode, setTurnDetectionMode] = useState<'adaptive' | 'realtime_llm' | 'vad' | 'stt' | 'manual'>('adaptive');
  const [bargeInEnabled, setBargeInEnabled] = useState(true);
  const [bargeInMode, setBargeInMode] = useState<'adaptive' | 'vad'>('adaptive');
  const [bargeInMinDuration, setBargeInMinDuration] = useState(0.5);
  const [bargeInMinWords, setBargeInMinWords] = useState(1);
  const [resumeFalseInterruption, setResumeFalseInterruption] = useState(true);
  const [preemptiveGeneration, setPreemptiveGeneration] = useState(true);
  const [userAwayTimeoutEnabled, setUserAwayTimeoutEnabled] = useState(true);
  const [userAwayTimeout, setUserAwayTimeout] = useState(15);
  // VAD Settings
  const [vadMinSpeechDuration, setVadMinSpeechDuration] = useState(0.05);
  const [vadMinSilenceDuration, setVadMinSilenceDuration] = useState(0.55);
  const [vadPrefixPaddingDuration, setVadPrefixPaddingDuration] = useState(0.5);
  const [vadActivationThreshold, setVadActivationThreshold] = useState(0.5);
  const [vadDeactivationThreshold, setVadDeactivationThreshold] = useState(0.35);
  const [vadMaxBufferedSpeech, setVadMaxBufferedSpeech] = useState(60.0);
  const [vadSampleRate, setVadSampleRate] = useState(16000);
  const [vadForceCpu, setVadForceCpu] = useState(true);
  const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState(true);
  const [minConsecutiveSpeechDelayEnabled, setMinConsecutiveSpeechDelayEnabled] = useState(true);
  const [minConsecutiveSpeechDelay, setMinConsecutiveSpeechDelay] = useState(200);
  const [closeOnDisconnect, setCloseOnDisconnect] = useState(true);
  const [deleteRoomOnEnd, setDeleteRoomOnEnd] = useState(false);
  const [onSessionEndCallback, setOnSessionEndCallback] = useState(false);
  const [onRequestCallback, setOnRequestCallback] = useState(false);
  const [ivrDtmfDetection, setIvrDtmfDetection] = useState(false);
  const [endpointingDelayEnabled, setEndpointingDelayEnabled] = useState(true);
  const [endpointingDelayMode, setEndpointingDelayMode] = useState<'dynamic' | 'fixed'>('dynamic');
  const [endpointingMinDelay, setEndpointingMinDelay] = useState(200);
  const [endpointingMaxDelay, setEndpointingMaxDelay] = useState(2000);
  const [dynamicEndpointing, setDynamicEndpointing] = useState(false);
  const [discardAudioIfUninterruptible, setDiscardAudioIfUninterruptible] = useState(false);
  const [audioOutputEnabled, setAudioOutputEnabled] = useState(true);
  const [textOutputEnabled, setTextOutputEnabled] = useState(true);
  
  // Step 1 State
  const [displayName, setDisplayName] = useState('');
  const [serviceName, setServiceName] = useState('');

  // Step 2 State
  const [lkUrl, setLkUrl] = useState('');
  const [lkKey, setLkKey] = useState('');
  const [lkSecret, setLkSecret] = useState('');

  // Step 3 State
  const [sttKey, setSttKey] = useState('');

  // Step 4 State
  const [ttsKey, setTtsKey] = useState('');
  const [ttsVoiceId, setTtsVoiceId] = useState('');

  // Step 5 State
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);
  const deployedUrl = "https://devant.wso2.com/voice-agent/agent-x98f";

  const isStepValid = () => {
    if (setupStep === 1) {
      return displayName.trim() !== '' && serviceName.trim() !== '';
    }
    if (setupStep === 2) {
      return lkUrl.trim() !== '' && lkKey.trim() !== '' && lkSecret.trim() !== '';
    }
    if (setupStep === 3) {
      return sttKey.trim() !== '';
    }
    if (setupStep === 4) {
      if (ttsModel === 'cartesia') {
        return ttsKey.trim() !== '' && ttsVoiceId.trim() !== '';
      }
      return ttsKey.trim() !== '';
    }
    return true;
  };

  const handleNextStep = () => {
    if (setupStep < 5) {
      setSetupStep(setupStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (setupStep > 1 && !isDeploying && !isDeployed) {
      setSetupStep(setupStep - 1);
    }
  };

  const handleDeploy = () => {
    setIsDeploying(true);
    setTimeout(() => {
      setServices([...services, {
        displayName,
        serviceName,
        sttModel,
        ttsModel,
        url: deployedUrl
      }]);
      setIsDeploying(false);
      setIsDeployed(true);
      
      // Auto redirect to list after a small delay or immediately
      setView('list');
      setSetupStep(1);
      setIsDeployed(false);
      setDisplayName('');
      setServiceName('');
      setLkUrl('');
      setLkKey('');
      setLkSecret('');
      setSttKey('');
      setTtsKey('');
      setTtsVoiceId('');
    }, 2500);
  };

  const handleDeleteService = (index: number) => {
    const newServices = [...services];
    newServices.splice(index, 1);
    setServices(newServices);
  };

  const handleAgentClick = (agent: any) => {
    setSelectedAgent(agent);
    setView('details');
  };

  const [demoIsFetching, setDemoIsFetching] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoConnectionDetails, setDemoConnectionDetails] = useState<{ url: string; token: string } | null>(null);

  const startDemoSession = async () => {
    try {
      setDemoIsFetching(true);
      setDemoError(null);
      const data = await fetchConnectionDetails('demo-user');
      setDemoConnectionDetails(data);
    } catch (err) {
      setDemoError('Could not start demo');
    } finally {
      setDemoIsFetching(false);
    }
  };

  const endDemoSession = () => setDemoConnectionDetails(null);

  const VoiceAgentTester = () => {
    const connectionState = useConnectionState();
    const isConnected = connectionState === ConnectionState.Connected;
    const isConnecting = connectionState === ConnectionState.Connecting || demoIsFetching;
    
    return (
      <div style={{ backgroundColor: '#f4f8fc', borderRadius: '12px', border: '1px solid var(--wso2-primary)', color: '#1e293b', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 24px rgba(35, 82, 155, 0.08)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(135, 178, 232, 0.2) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
        
        {/* Header */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 1, borderBottom: '1px solid rgba(135, 178, 232, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wso2-blue)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <Mic size={20} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{selectedAgent?.displayName || 'Jarvis'}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>WSO2 Voice Assistant</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isConnected && (
                <>
                  <button 
                    onClick={async () => { endDemoSession(); setTimeout(startDemoSession, 500); }}
                    title="Restart Session"
                    style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button 
                    onClick={endDemoSession}
                    title="Stop Session"
                    style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Square size={14} fill="#ef4444" />
                  </button>
                </>
              )}
              <button 
                onClick={() => window.location.href = '/'}
                title="Open in Full Screen"
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', backgroundColor: isConnected ? '#f0fdf4' : 'white', border: `1px solid ${isConnected ? '#dcfce7' : 'rgba(135, 178, 232, 0.5)'}` }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isConnected ? '#166534' : '#64748b' }}></div>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: isConnected ? '#166534' : '#475569' }}>{isConnected ? 'Live' : isConnecting ? 'Connecting' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* Center Canvas / Orb */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative' }}>
          <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Rings */}
            <div style={{ position: 'absolute', inset: 0, border: '1px dashed rgba(35, 82, 155, 0.2)', borderRadius: '50%', animation: 'spin 40s linear infinite' }}></div>
            <div style={{ position: 'absolute', inset: '15%', border: '1px solid rgba(35, 82, 155, 0.1)', borderRadius: '50%', animation: 'spin 25s linear infinite reverse' }}></div>
            <div style={{ position: 'absolute', inset: '30%', border: '1px solid rgba(135, 178, 232, 0.3)', borderRadius: '50%', animation: 'spin 20s linear infinite' }}></div>
            
            {/* Core Orb */}
            <div style={{ 
              position: 'absolute', 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, var(--wso2-primary) 50%, var(--wso2-blue) 90%)',
              boxShadow: isConnected ? '0 0 30px rgba(35, 82, 155, 0.4), 0 0 60px rgba(135, 178, 232, 0.3)' : '0 0 15px rgba(35, 82, 155, 0.15)',
              animation: isConnected ? 'breathe 2s ease-in-out infinite' : 'breathe 4s ease-in-out infinite',
              opacity: isConnecting && !isConnected ? 0.5 : 1,
              border: '2px solid white'
            }}></div>
          </div>
          
          <div style={{ marginTop: '40px', textAlign: 'center', padding: '0 32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px 0' }}>Say hello</h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Press Start Session to interact with your WSO2 voice agent.
            </p>
          </div>
        </div>

        {/* Footer / Button */}
        <div style={{ padding: '24px', zIndex: 1, borderTop: '1px solid rgba(135, 178, 232, 0.3)' }}>
          <button 
            onClick={isConnected ? endDemoSession : startDemoSession}
            disabled={isConnecting && !isConnected}
            style={{ 
              width: '100%', 
              padding: '14px', 
              borderRadius: '8px', 
              border: 'none', 
              background: isConnected ? '#ef4444' : 'var(--wso2-blue)', 
              color: 'white', 
              fontWeight: 500, 
              fontSize: '14px', 
              cursor: isConnecting && !isConnected ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: isConnecting && !isConnected ? 0.7 : 1,
              boxShadow: isConnected ? '0 4px 12px rgba(239, 68, 68, 0.2)' : '0 4px 12px rgba(35, 82, 155, 0.2)'
            }}
          >
            {isConnected ? (
              <>Stop Session</>
            ) : isConnecting ? (
              <>Connecting...</>
            ) : (
              <><Mic size={16} /> Start Session</>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes breathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}</style>
        <RoomAudioRenderer />
      </div>
    );
  };

  const renderSidebar = () => (
    <div className="devant-sidebar">
      <div className="sidebar-header">
        <Network size={24} color="var(--wso2-blue)" style={{backgroundColor: 'white', borderRadius: '50%', padding: '2px'}} />
        <div className="title">
          WSO2<br/>
          Integration Platform
        </div>
      </div>
      
      <div className="sidebar-menu">
        <div className="menu-item"><LayoutDashboard /> Overview</div>
        <div className="menu-item"><Code2 /> Develop</div>
        <div className="menu-item"><Box /> Build</div>
        <div className="menu-item"><Rocket /> Deploy</div>
        <div className="menu-item"><TestTube2 /> Test</div>
        <div className="menu-item"><LineChart /> Insights</div>
        <div className="menu-item"><Activity /> Observability</div>
        <div className={`menu-item ${view === 'setup' || view === 'list' ? 'active' : ''}`} onClick={() => { setView('setup'); setSetupStep(1); setSelectedAgent(null); }}>
          <Mic /> Voice AI
        </div>
        
        <div className="menu-group-title" onClick={() => setIsAdminExpanded(!isAdminExpanded)}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <Database /> Admin
          </div>
          <ChevronDown style={{ transform: isAdminExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        
        {isAdminExpanded && (
          <div className="sub-menu">
            <div className="sub-menu-item"><Database size={16} /> Databases</div>
            <div className="sub-menu-item"><Server size={16} /> Vector Databases</div>
            <div className="sub-menu-item"><MessageCircle size={16} /> Message Brokers</div>
            <div className="sub-menu-item"><Link size={16} /> Third Party Services</div>
            <div className="sub-menu-item"><Sparkles size={16} /> GenAI Services</div>
            <div className="sub-menu-item"><Settings size={16} /> Config Groups</div>
            <div className="sub-menu-item"><ShieldCheck size={16} /> Governance</div>
            <div className="sub-menu-item"><GitMerge size={16} /> CD Pipelines</div>
            <div className="sub-menu-item"><Layers size={16} /> Data Planes</div>
          </div>
        )}
      </div>
      
      <div className="sidebar-footer">
        <ChevronLeft size={16} /> Collapse
      </div>
    </div>
  );

  const renderTopbar = () => (
    <div className="devant-topbar">
      <div className="topbar-left">
        <div className="org-selector">
          <span>Organization</span>
          <div className="org-name">
            Voice Agents <ChevronDown size={14} />
          </div>
        </div>
        <div style={{ padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
          <ChevronDown size={16} color="#64748b" style={{ transform: 'rotate(-90deg)'}} />
        </div>
      </div>
      <div className="topbar-right">
        <button className="copilot-btn">
          <Sparkles /> Copilot
        </button>
        <div className="avatar"></div>
      </div>
    </div>
  );

  const renderProviderCard = (name: string, selected: boolean, onClick: () => void, logoUrl?: string, hasModelSelect: boolean = false, IconComponent?: React.ElementType) => (
    <div className={`provider-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      {logoUrl ? (
        <img src={logoUrl} alt={`${name} logo`} style={{width: '32px', height: '32px', objectFit: 'contain'}} />
      ) : IconComponent ? (
        <div style={{width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10a37f'}}>
          <IconComponent size={28} />
        </div>
      ) : (
        <div style={{width: '32px', height: '32px', backgroundColor: '#e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#475569'}}>
          {name.substring(0, 2).toUpperCase()}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="provider-name">{name}</div>
        {hasModelSelect && (
          <div onClick={(e) => e.stopPropagation()} style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <select style={{ border: 'none', background: 'transparent', outline: 'none', color: '#64748b', fontSize: '12px', padding: 0, cursor: 'pointer', appearance: 'none' }}>
              <option>Select a Model</option>
              <option>Standard</option>
              <option>Premium</option>
            </select>
            <ChevronDown size={12} />
          </div>
        )}
      </div>
    </div>
  );

  const renderLabelWithTooltip = (label: string, tooltipText: string) => (
    <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
      {label}
      <span title={tooltipText} style={{ marginLeft: '6px', display: 'flex', cursor: 'help' }}>
        <Info size={14} color="#94a3b8" />
      </span>
    </label>
  );

  const renderServiceDetails = () => (
    <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '32px 48px', overflowY: 'auto' }}>
      <button 
        onClick={() => setView('list')}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--wso2-blue)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginBottom: '24px', fontSize: '14px', fontWeight: 500 }}
      >
        <ChevronLeft size={16} /> Back to Voice AI Agents
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <LiveKitLogo size={24} color="var(--wso2-blue)" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>{selectedAgent?.displayName}</h1>
            <div style={{ color: '#64748b', fontSize: '14px' }}>Voice AI Service • {selectedAgent?.serviceName}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            disabled={!isAgentRunning}
            onClick={() => { setIsAgentRunning(false); setTimeout(() => setIsAgentRunning(true), 1000); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: isAgentRunning ? '#475569' : '#94a3b8', fontSize: '14px', fontWeight: 500, cursor: isAgentRunning ? 'pointer' : 'not-allowed', opacity: isAgentRunning ? 1 : 0.6 }}
          >
            <RotateCcw size={16} /> Restart
          </button>
          <button 
            disabled={!isAgentRunning}
            onClick={() => setIsAgentRunning(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fee2e2', color: '#ef4444', fontSize: '14px', fontWeight: 500, cursor: isAgentRunning ? 'pointer' : 'not-allowed', opacity: isAgentRunning ? 1 : 0.6 }}
          >
            <Square size={16} fill="#ef4444" /> Stop
          </button>
          <button 
            disabled={isAgentRunning}
            onClick={() => setIsAgentRunning(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--wso2-blue)', color: 'white', fontSize: '14px', fontWeight: 500, cursor: !isAgentRunning ? 'pointer' : 'not-allowed', opacity: !isAgentRunning ? 1 : 0.6 }}
          >
            <Play size={16} fill="white" /> Start
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '32px' }}>
        {['Overview', 'Configure', 'Settings'].map((tab) => (
          <div 
            key={tab} 
            onClick={() => setActiveDetailTab(tab)}
            style={{ 
              padding: '12px 24px', 
              fontSize: '14px', 
              fontWeight: 500, 
              color: activeDetailTab === tab ? 'var(--wso2-blue)' : '#64748b',
              borderBottom: activeDetailTab === tab ? '2px solid var(--wso2-blue)' : 'none',
              cursor: 'pointer'
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {activeDetailTab === 'Overview' && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px' }}>
        {/* Left Column (Details) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Service Status */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Service Status</h3>
              <div style={{ backgroundColor: isAgentRunning ? '#f0fdf4' : '#fef2f2', color: isAgentRunning ? '#166534' : '#991b1b', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>{isAgentRunning ? 'Running' : 'Stopped'}</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>Endpoint Host</span>
                <span style={{ color: '#1e293b', fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedAgent?.url}</span>
              </div>
            </div>
          </div>

          {/* Deployment Info */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deployment Info</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>Region</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>Digital Ocean - US East</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>Created</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>Just now</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>Source Project</div>
                <div style={{ fontSize: '14px', color: 'var(--wso2-blue)', fontWeight: 600 }}>sample-agent</div>
              </div>
            </div>
          </div>

          {/* Provider Configuration */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Provider Configuration</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Speech To Text Provider</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{selectedAgent?.sttModel?.toUpperCase()}</span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>Model: {selectedAgent?.sttModel === 'deepgram' ? 'Nova-2' : selectedAgent?.sttModel === 'cartesia' ? 'Sonic' : 'Default'}</span>
                </div>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Text To Speech Provider</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{selectedAgent?.ttsModel?.toUpperCase()}</span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>Voice: {selectedAgent?.ttsVoiceId || 'Default Voice'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Capabilities */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>Active Capabilities</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['Barge-in', 'Turn Detection', 'VAD', 'Multilingual'].map(cap => (
                <div key={cap} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 500, border: '1px solid #e2e8f0' }}>
                  {cap}
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Right Column (Live Tester) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <LiveKitRoom
            token={demoConnectionDetails?.token}
            serverUrl={demoConnectionDetails?.url}
            connect={!!demoConnectionDetails}
            audio={true}
            onDisconnected={endDemoSession}
            style={{ height: '100%' }}
          >
            <VoiceAgentTester />
          </LiveKitRoom>
        </div>
      </div>
      )}

      {activeDetailTab === 'Logs' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '600px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '0 16px', borderBottom: '1px solid #334155' }}>
            {['Voice Pipeline', 'Agent'].map((logTab) => (
              <div 
                key={logTab}
                onClick={() => setActiveLogTab(logTab as any)}
                style={{ 
                  padding: '12px 20px', 
                  fontSize: '13px', 
                  fontWeight: 500, 
                  color: activeLogTab === logTab ? 'white' : '#94a3b8',
                  borderBottom: activeLogTab === logTab ? '2px solid #38bdf8' : 'none',
                  cursor: 'pointer'
                }}
              >
                {logTab}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', color: '#e2e8f0', lineHeight: 1.6 }}>
            {activeLogTab === 'Voice Pipeline' ? (
              <>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:30:01]</span> <span style={{ color: '#22c55e' }}>INFO</span> Starting Voice Pipeline server on port 8080...</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:30:02]</span> <span style={{ color: '#22c55e' }}>INFO</span> Loading STT model: deepgram/nova-3-general</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:30:05]</span> <span style={{ color: '#22c55e' }}>INFO</span> Loading TTS model: cartesia/sonic-3</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:30:07]</span> <span style={{ color: '#22c55e' }}>INFO</span> Connected to LiveKit Cloud</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:31:12]</span> <span style={{ color: '#eab308' }}>WARN</span> High latency detected in STT stream (120ms)</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:32:01]</span> <span style={{ color: '#22c55e' }}>INFO</span> New session started: sess_x82kf92</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:32:05]</span> <span style={{ color: '#38bdf8' }}>DEBUG</span> STT Transcription: "Hello, how can I help you today?"</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:32:08]</span> <span style={{ color: '#38bdf8' }}>DEBUG</span> LLM Response generated in 450ms</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:32:10]</span> <span style={{ color: '#38bdf8' }}>DEBUG</span> TTS Synthesis complete for 12 words</div>
              </>
            ) : (
              <>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:30:00]</span> <span style={{ color: '#22c55e' }}>INFO</span> Initializing Ballerina Agent...</div>
                <div><span style={{ code: '#64748b' }}>[2024-05-04 13:30:01]</span> <span style={{ color: '#22c55e' }}>INFO</span> Service voice-agent-x98f registered successfully</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:30:01]</span> <span style={{ color: '#22c55e' }}>INFO</span> Listening on https://0.0.0.0:9090</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:32:01]</span> <span style={{ color: '#22c55e' }}>INFO</span> Inbound connection received from worker-node-04</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:32:02]</span> <span style={{ color: '#22c55e' }}>INFO</span> Forwarding audio stream to pipeline-svc:8080</div>
                <div><span style={{ color: '#64748b' }}>[2024-05-04 13:32:15]</span> <span style={{ color: '#22c55e' }}>INFO</span> Handled user interrupt (Barge-in detected)</div>
              </>
            )}
          </div>
        </div>
      )}

      {activeDetailTab === 'Settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 24px 0' }}>General Settings</h2>
            
            <div style={{ display: 'grid', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input type="text" className="form-input" defaultValue={selectedAgent?.displayName} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" placeholder="Describe what this agent does..." style={{ height: '100px' }}></textarea>
              </div>
              <div className="form-group">
                <label className="form-label">Default Region</label>
                <select className="form-select">
                  <option>Digital Ocean - US East</option>
                  <option>AWS - US West</option>
                  <option>GCP - Europe West</option>
                </select>
              </div>
            </div>
            
            <div style={{ marginTop: '32px', padding: '24px', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} /> Danger Zone
              </h3>
              <p style={{ color: '#c2410c', fontSize: '14px', marginBottom: '20px' }}>
                Once you delete a voice agent service, there is no going back. Please be certain.
              </p>
              <button 
                onClick={() => setShowDeleteDialog(true)}
                style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete this agent
              </button>
            </div>
          </div>
        </div>
      )}

      {activeDetailTab === 'Configure' && (
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: '0 0 24px 0' }}>Agent Configuration</h2>
          
          <div style={{ display: 'grid', gap: '24px' }}>
            {/* LiveKit Connection */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>LiveKit Connection</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  {renderLabelWithTooltip('LiveKit URL', 'The WebSocket URL of your LiveKit server or Cloud project.')}
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="wss://project.livekit.cloud" 
                    value={lkUrl} 
                    onChange={(e) => setLkUrl(e.target.value)} 
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {renderLabelWithTooltip('API Key', 'The project\'s API Key used to authenticate your agent.')}
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="API Key" 
                    value={lkKey} 
                    onChange={(e) => setLkKey(e.target.value)} 
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {renderLabelWithTooltip('API Secret', 'The project\'s API Secret used for secure authentication.')}
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="API Secret" 
                    value={lkSecret} 
                    onChange={(e) => setLkSecret(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* STT Config */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>Speech-to-Text (STT)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  {renderLabelWithTooltip('Provider', 'The external AI service that handles the conversion of user speech into text.')}
                  <select className="form-select" value={configSttProvider} onChange={(e) => { setConfigSttProvider(e.target.value); setConfigSttModel(STT_PROVIDERS[e.target.value].models[0].id); setConfigSttLang(STT_PROVIDERS[e.target.value].languages[0].code); }}>
                    <option value="deepgram">Deepgram</option>
                    <option value="assemblyai">AssemblyAI</option>
                    <option value="cartesia">Cartesia</option>
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="xai">xAI</option>
                  </select>
                </div>
                <div>
                  {renderLabelWithTooltip('Model', 'The specific version of the AI model to use for transcription.')}
                  <select className="form-select" value={configSttModel} onChange={(e) => setConfigSttModel(e.target.value)}>
                    {STT_PROVIDERS[configSttProvider]?.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
                {renderLabelWithTooltip('API Key', 'The secret authentication key from your chosen STT provider.')}
                <input type="password" placeholder="sk-..." className="form-input" />
              </div>
            </div>

            {/* TTS Config */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>Text-to-Speech (TTS)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  {renderLabelWithTooltip('Provider', 'The external AI service that handles the conversion of text responses into spoken audio.')}
                  <select className="form-select" value={configTtsProvider} onChange={(e) => { setConfigTtsProvider(e.target.value); setConfigTtsModel(TTS_PROVIDERS[e.target.value].models[0].id); setSelectedVoice(TTS_PROVIDERS[e.target.value].voices[0].id); setConfigTtsLang(TTS_PROVIDERS[e.target.value].languages[0].code); }}>
                    <option value="cartesia">Cartesia</option>
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="deepgram">Deepgram</option>
                    <option value="rime">Rime</option>
                    <option value="inworld">Inworld</option>
                    <option value="xai">xAI</option>
                  </select>
                </div>
                <div>
                  {renderLabelWithTooltip('Model', 'The specific AI model to use for speech synthesis.')}
                  <select className="form-select" value={configTtsModel} onChange={(e) => setConfigTtsModel(e.target.value)}>
                    {TTS_PROVIDERS[configTtsProvider]?.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  {renderLabelWithTooltip('Language', 'The primary language the agent will use when speaking.')}
                  <select className="form-select" value={configTtsLang} onChange={(e) => setConfigTtsLang(e.target.value)}>
                    {TTS_PROVIDERS[configTtsProvider]?.languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  {renderLabelWithTooltip('Voice', 'The specific digital persona or character voice.')}
                  <select className="form-select" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
                    {TTS_PROVIDERS[configTtsProvider]?.voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              {selectedVoice === 'custom' && (
                <div style={{ marginBottom: '16px' }}>
                  {renderLabelWithTooltip('Custom Voice ID', 'A unique identifier for a custom-trained or cloned voice.')}
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter Voice ID"
                    value={customVoiceId}
                    onChange={(e) => setCustomVoiceId(e.target.value)}
                  />
                </div>
              )}
              <div style={{ paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
                {renderLabelWithTooltip('API Key', 'The secret authentication key from your chosen TTS provider.')}
                <input type="password" placeholder="sk-..." className="form-input" />
              </div>
            </div>

            {/* Text Output, User Interaction, Session Cleanup */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
              {/* Text Output */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>Text Output</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="text-output-toggle"
                    checked={textOutputEnabled} 
                    onChange={(e) => setTextOutputEnabled(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                  />
                  {renderLabelWithTooltip('Text Output / Transcription', 'Displays a real-time text version of everything the user and agent say.')}
                </div>
              </div>

              {/* User Interaction & Timing Config */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>User Interaction & Timing</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input 
                        type="checkbox" 
                        id="user-away-toggle"
                        checked={userAwayTimeoutEnabled} 
                        onChange={(e) => setUserAwayTimeoutEnabled(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                      />
                      {renderLabelWithTooltip('User Away Timeout', 'The amount of time to wait before the agent assumes the user has left the conversation if no audio is detected.')}
                    </div>
                    {userAwayTimeoutEnabled && (
                      <div className="form-group" style={{ margin: 0, maxWidth: '150px', marginLeft: '26px' }}>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ paddingRight: '30px' }}
                            value={userAwayTimeout} 
                            onChange={(e) => setUserAwayTimeout(parseInt(e.target.value))} 
                          />
                          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8' }}>s</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input 
                        type="checkbox" 
                        id="min-consecutive-speech-toggle"
                        checked={minConsecutiveSpeechDelayEnabled} 
                        onChange={(e) => setMinConsecutiveSpeechDelayEnabled(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                      />
                      {renderLabelWithTooltip('Min Consecutive Speech Delay', 'Controls how long the agent waits before it starts speaking, specifically to avoid the agent immediately talking over the user if the user pauses mid-thought very briefly.')}
                    </div>
                    {minConsecutiveSpeechDelayEnabled && (
                      <div className="form-group" style={{ margin: 0, maxWidth: '150px', marginLeft: '26px' }}>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ paddingRight: '35px' }}
                            value={minConsecutiveSpeechDelay} 
                            onChange={(e) => setMinConsecutiveSpeechDelay(parseInt(e.target.value))} 
                          />
                          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8' }}>ms</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Session Cleanup & Lifecycle Config */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>Session Cleanup & Lifecycle</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input 
                        type="checkbox" 
                        id="close-on-disconnect-toggle"
                        checked={closeOnDisconnect} 
                        onChange={(e) => setCloseOnDisconnect(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                      />
                      {renderLabelWithTooltip('Close on Participant Disconnect', 'If enabled, the agent service will automatically shut down as soon as the user leaves.')}
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Advanced Settings */}
            <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b',letterSpacing: '0.05em' }}>
                    Advanced Settings
                  </div>
                  <span style={{ padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px', color: '#475569', fontWeight: 600 }}>Configure</span>
                </div>
                <button 
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  style={{ padding: '6px 12px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}
                >
                  <Settings size={14} /> Configure
                </button>
              </div>
              
              {showAdvancedSettings && (
                <div style={{ marginTop: '24px', display: 'grid', gap: '24px' }}>
                  {/* VAD Config */}
                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', margin: '0 0 16px 0' }}>Voice Activity Detection (VAD)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        {renderLabelWithTooltip('Min Speech Duration (s)', 'The minimum amount of time (in seconds) that a sound must last to be recognized as human speech. This helps filter out short background noises.')}
                        <input type="number" step="0.01" className="form-input" value={vadMinSpeechDuration} onChange={(e) => setVadMinSpeechDuration(parseFloat(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        {renderLabelWithTooltip('Min Silence Duration (s)', 'The duration of silence (in seconds) required to determine that a person has finished speaking. A higher value allows for longer pauses during speech.')}
                        <input type="number" step="0.01" className="form-input" value={vadMinSilenceDuration} onChange={(e) => setVadMinSilenceDuration(parseFloat(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        {renderLabelWithTooltip('Prefix Padding Duration (s)', 'The amount of audio (in seconds) captured before the speech was officially detected. This ensures the beginning of the first word isn\'t clipped.')}
                        <input type="number" step="0.01" className="form-input" value={vadPrefixPaddingDuration} onChange={(e) => setVadPrefixPaddingDuration(parseFloat(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        {renderLabelWithTooltip('Activation Threshold', 'The confidence level (0 to 1) required to trigger speech detection. A higher value makes the agent less likely to be triggered by background noise.')}
                        <input type="number" step="0.01" className="form-input" value={vadActivationThreshold} onChange={(e) => setVadActivationThreshold(parseFloat(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        {renderLabelWithTooltip('Deactivation Threshold', 'The confidence level (0 to 1) below which speech is considered to have ended. This is usually lower than the activation threshold to avoid cutting off mid-sentence.')}
                        <input type="number" step="0.01" className="form-input" value={vadDeactivationThreshold} onChange={(e) => setVadDeactivationThreshold(parseFloat(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        {renderLabelWithTooltip('Max Buffered Speech (s)', 'The maximum length of audio (in seconds) the agent will store in its temporary memory while waiting to process it.')}
                        <input type="number" step="0.1" className="form-input" value={vadMaxBufferedSpeech} onChange={(e) => setVadMaxBufferedSpeech(parseFloat(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        {renderLabelWithTooltip('Sample Rate (Hz)', 'The number of audio samples processed per second. 16,000 Hz (16kHz) is standard for most speech-to-text models.')}
                        <input type="number" className="form-input" value={vadSampleRate} onChange={(e) => setVadSampleRate(parseInt(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {renderLabelWithTooltip('Noise Cancellation', 'Automatically filters out background noise like fans or static to improve speech recognition quality.')}
                        <input type="checkbox" checked={noiseCancellationEnabled} onChange={(e) => setNoiseCancellationEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} />
                      </div>
                    </div>
                  </div>

                  {/* Turn Detection & Interruptions */}
                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', margin: '0 0 16px 0' }}>Turn Detection & Interruptions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Turn Detection Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input 
                            type="checkbox" 
                            id="turn-detection-toggle"
                            checked={turnDetectionEnabled} 
                            onChange={(e) => setTurnDetectionEnabled(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                          />
                          {renderLabelWithTooltip('Turn Detection', 'Automatically identifies when a user has finished their sentence so the agent knows exactly when to start responding.')}
                        </div>
                        
                        {turnDetectionEnabled && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '26px' }}>
                            {[
                              { id: 'adaptive', label: 'Turn Detector Model - MultilingualModel' },
                              { id: 'vad', label: 'VAD Only' },
                              { id: 'stt', label: 'STT Endpointing' },
                            ].map(mode => (
                              <button
                                key={mode.id}
                                onClick={() => setTurnDetectionMode(mode.id as any)}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  border: '1px solid',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  backgroundColor: turnDetectionMode === mode.id ? '#eff6ff' : 'white',
                                  borderColor: turnDetectionMode === mode.id ? '#3b82f6' : '#e2e8f0',
                                  color: turnDetectionMode === mode.id ? '#2563eb' : '#64748b'
                                }}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }}></div>

                      {/* Interruptions Section */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="checkbox" 
                              id="barge-in-toggle"
                              checked={bargeInEnabled} 
                              onChange={(e) => setBargeInEnabled(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                            />
                            {renderLabelWithTooltip('Barge-in / Interruptions', 'When enabled, the user can speak while the agent is talking, and the agent will immediately stop to listen.')}
                          </div>
                          
                          {bargeInEnabled && (
                            <div style={{ marginLeft: '26px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Mode', 'The method used to detect interruptions. \'Adaptive\' is usually best as it learns to distinguish between noise and real speech.')}
                                <select 
                                  className="form-select" 
                                  style={{ height: '32px', fontSize: '12px', padding: '0 8px' }}
                                  value={bargeInMode}
                                  onChange={(e) => setBargeInMode(e.target.value as any)}
                                >
                                  <option value="adaptive">Adaptive</option>
                                  <option value="vad">VAD Only</option>
                                </select>
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Min Duration (s)', 'How long the user must speak (in seconds) before the agent considers it a real interruption.')}
                                <input 
                                  type="number" 
                                  step="0.1"
                                  className="form-input" 
                                  style={{ height: '32px', fontSize: '12px', padding: '0 8px', width: '100%' }}
                                  value={bargeInMinDuration}
                                  onChange={(e) => setBargeInMinDuration(parseFloat(e.target.value))}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Min Words', 'The minimum number of words the user must say to successfully interrupt the agent.')}
                                <input 
                                  type="number" 
                                  className="form-input" 
                                  style={{ height: '32px', fontSize: '12px', padding: '0 8px', width: '100%' }}
                                  value={bargeInMinWords}
                                  onChange={(e) => setBargeInMinWords(parseInt(e.target.value))}
                                />
                              </div>
                              <div style={{ gridColumn: 'span 3', marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input 
                                    type="checkbox" 
                                    id="discard-audio-toggle"
                                    checked={discardAudioIfUninterruptible} 
                                    onChange={(e) => setDiscardAudioIfUninterruptible(e.target.checked)}
                                    style={{ width: '14px', height: '14px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                                  />
                                  {renderLabelWithTooltip('Discard Audio if Uninterruptible', 'If the agent is in a critical non-stop phase, this determines if it should completely ignore user speech.')}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="checkbox" 
                              id="endpointing-toggle"
                              checked={endpointingDelayEnabled} 
                              onChange={(e) => setEndpointingDelayEnabled(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                            />
                            {renderLabelWithTooltip('Endpointing Delay', 'The strategy used to decide exactly how long to wait after the user stops speaking before responding.')}
                          </div>
                          
                          {endpointingDelayEnabled && (
                            <div style={{ marginLeft: '26px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Mode', '\'Fixed\' uses a constant wait time, while \'Dynamic\' adjusts the wait time automatically based on how the user is speaking.')}
                                <select 
                                  className="form-select" 
                                  style={{ height: '32px', fontSize: '12px', padding: '0 8px' }}
                                  value={endpointingDelayMode}
                                  onChange={(e) => setEndpointingDelayMode(e.target.value as any)}
                                >
                                  <option value="dynamic">Dynamic</option>
                                  <option value="fixed">Fixed</option>
                                </select>
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Min Delay (ms)', 'The minimum time (in milliseconds) the agent must wait after speech stops.')}
                                <input 
                                  type="number" 
                                  className="form-input" 
                                  style={{ height: '32px', fontSize: '12px', padding: '0 8px', width: '100%' }}
                                  value={endpointingMinDelay}
                                  onChange={(e) => setEndpointingMinDelay(parseInt(e.target.value))}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Max Delay (ms)', 'The maximum time (in milliseconds) the agent will wait before it MUST generate a response.')}
                                <input 
                                  type="number" 
                                  className="form-input" 
                                  style={{ height: '32px', fontSize: '12px', padding: '0 8px', width: '100%' }}
                                  value={endpointingMaxDelay}
                                  onChange={(e) => setEndpointingMaxDelay(parseInt(e.target.value))}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                onClick={() => setShowSaveDialog(true)}
                className="primary-btn deploy-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Check size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Dialog */}
      {showSaveDialog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <Info size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Deploy Changes</h3>
            </div>
            <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>
              Saving these changes will trigger a restart of the voice agent service. Active sessions may be temporarily disconnected. Do you wish to proceed?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                disabled={isSaving}
                onClick={() => setShowSaveDialog(false)}
                className="secondary-btn"
              >
                Cancel
              </button>
              <button 
                disabled={isSaving}
                onClick={() => {
                  setIsSaving(true);
                  setTimeout(() => {
                    setIsSaving(false);
                    setShowSaveDialog(false);
                  }, 2000);
                }}
                className="primary-btn deploy-btn"
                style={{ minWidth: '120px', display: 'flex', justifyContent: 'center' }}
              >
                {isSaving ? <Loader2 size={16} className="spinner" /> : 'Confirm & Restart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#ef4444' }}>
              <Trash2 size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Delete Voice Agent</h3>
            </div>
            <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{selectedAgent?.displayName}</strong>? This action will immediately stop the service and remove all associated configurations. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setShowDeleteDialog(false)}
                className="secondary-btn"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setServices(services.filter(s => s.serviceName !== selectedAgent.serviceName));
                  setView('list');
                  setSelectedAgent(null);
                  setShowDeleteDialog(false);
                }}
                style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="devant-layout">
      {renderSidebar()}
      
      <div className="devant-main">
        {renderTopbar()}
        
        <div className="devant-content">
          {view === 'details' ? renderServiceDetails() : view === 'setup' ? (
            <>
              <div className="stepper-sidebar">
                <div className={`step-item ${setupStep === 1 ? 'active' : setupStep > 1 ? 'completed' : ''}`}>
              <div className="step-number">{setupStep > 1 ? <Check size={16} /> : "1"}</div>
              <div className="step-content">
                <div className="step-label">Step 1</div>
                <div className="step-title">General Information</div>
              </div>
            </div>
            
            <div className={`step-item ${setupStep === 2 ? 'active' : setupStep > 2 ? 'completed' : ''}`}>
              <div className="step-number">{setupStep > 2 ? <Check size={16} /> : "2"}</div>
              <div className="step-content">
                <div className="step-label">Step 2</div>
                <div className="step-title">LiveKit Configuration (Optional)</div>
              </div>
            </div>
            
            <div className={`step-item ${setupStep === 3 ? 'active' : setupStep > 3 ? 'completed' : ''}`}>
              <div className="step-number">{setupStep > 3 ? <Check size={16} /> : "3"}</div>
              <div className="step-content">
                <div className="step-label">Step 3</div>
                <div className="step-title">Configure Speech to Text Model</div>
              </div>
            </div>

            <div className={`step-item ${setupStep === 4 ? 'active' : setupStep > 4 ? 'completed' : ''}`}>
              <div className="step-number">{setupStep > 4 ? <Check size={16} /> : "4"}</div>
              <div className="step-content">
                <div className="step-label">Step 4</div>
                <div className="step-title">Configure Text to Speech Model</div>
              </div>
            </div>

            <div className={`step-item ${setupStep === 5 ? 'active' : ''}`}>
              <div className="step-number">5</div>
              <div className="step-content">
                <div className="step-label">Step 5</div>
                <div className="step-title">Deploy Service</div>
              </div>
            </div>
          </div>
          
          <div className="setup-main">
            <h1 className="page-title">Setup Voice AI Service</h1>
            
            {setupStep === 1 && (
              <div>
                <h2 className="setup-step-title">General Information</h2>
                <div className="form-group">
                  {renderLabelWithTooltip('Target Project *', 'The specific workspace or project this agent belongs to. This helps organize your different voice AI services within the platform.')}
                  <select className="form-select" required defaultValue="sample-agent">
                    <option value="sample-agent">sample-agent</option>
                    <option value="default">default</option>
                  </select>
                </div>
                
                <div className="form-group">
                  {renderLabelWithTooltip('Display Name', 'A user-friendly name that will be shown in the dashboard to identify this agent (e.g., "Customer Support Bot").')}
                  <input type="text" className="form-input" placeholder="Enter display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                </div>
                
                <div className="form-group">
                  {renderLabelWithTooltip('Name', 'The unique internal identifier for this service. Usually lowercase with no spaces (e.g., "support-agent-v1").')}
                  <input type="text" className="form-input" placeholder="Enter service name" value={serviceName} onChange={(e) => setServiceName(e.target.value)} required />
                </div>
                
                <div className="form-group">
                  {renderLabelWithTooltip('Description (Optional)', 'A brief summary of what this agent does and its intended use case. Helpful for team collaboration.')}
                  <textarea className="form-textarea" placeholder="Enter description here"></textarea>
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div>
                <h2 className="setup-step-title">LiveKit Configuration (Optional)</h2>
                
                <div className="form-group">
                  {renderLabelWithTooltip('LiveKit URL', 'The endpoint for your LiveKit project. Your agent connects here to "hear" and "speak" to users in real-time. (e.g., wss://project.livekit.cloud)')}
                  <input type="text" className="form-input" placeholder="wss://your-livekit-instance" value={lkUrl} onChange={(e) => setLkUrl(e.target.value)} />
                </div>
                <div className="form-group">
                  {renderLabelWithTooltip('LiveKit API Key', 'Your unique access key for LiveKit. Think of it like a username for your agent\'s connection to the platform.')}
                  <input type="password" className="form-input" placeholder="Your API Key" value={lkKey} onChange={(e) => setLkKey(e.target.value)} />
                </div>
                <div className="form-group">
                  {renderLabelWithTooltip('LiveKit API Secret', 'A secure password that accompanies your API Key. Never share this with anyone else or commit it to public repositories.')}
                  <input type="password" className="form-input" placeholder="Your API Secret" value={lkSecret} onChange={(e) => setLkSecret(e.target.value)} />
                </div>
              </div>
            )}

            {setupStep === 3 && (
              <div>
                <h2 className="setup-step-title">Initialize Speech to Text Model</h2>
                <div className="cards-grid">
                  {renderProviderCard('Deepgram', sttModel === 'deepgram', () => setSttModel('deepgram'), 'https://cdn.simpleicons.org/deepgram/000000', false)}
                  {renderProviderCard('AssemblyAI', sttModel === 'assemblyai', () => setSttModel('assemblyai'), undefined, false)}
                  {renderProviderCard('Cartesia', sttModel === 'cartesia', () => setSttModel('cartesia'), undefined, false)}
                  {renderProviderCard('ElevenLabs', sttModel === 'elevenlabs', () => setSttModel('elevenlabs'), 'https://cdn.simpleicons.org/elevenlabs/000000', false)}
                  {renderProviderCard('xAI', sttModel === 'xai', () => setSttModel('xai'), undefined, false)}
                </div>
                
                <div style={{marginTop: '32px'}}>
                  {sttModel && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          {renderLabelWithTooltip('Model', 'The specific AI model used to transcribe spoken audio into text. Some models are optimized for speed, others for accuracy.')}
                          <select className="form-select">
                            {STT_PROVIDERS[sttModel]?.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          {renderLabelWithTooltip('Language', 'The language your agent should listen for. Selecting the correct language significantly improves transcription quality.')}
                          <select className="form-select">
                            {STT_PROVIDERS[sttModel]?.languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        {renderLabelWithTooltip(`${sttModel.charAt(0).toUpperCase() + sttModel.slice(1)} API Key`, `The secret key from your provider (e.g., Deepgram) that allows this agent to use their speech-to-text service.`)}
                        <input type="password" className="form-input" placeholder="Enter API Key" value={sttKey} onChange={(e) => setSttKey(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {setupStep === 4 && (
              <div>
                <h2 className="setup-step-title">Initialize Text to Speech Model</h2>
                <div className="cards-grid">
                  {renderProviderCard('Cartesia', ttsModel === 'cartesia', () => setTtsModel('cartesia'))}
                  {renderProviderCard('ElevenLabs', ttsModel === 'elevenlabs', () => setTtsModel('elevenlabs'), 'https://cdn.simpleicons.org/elevenlabs/000000')}
                  {renderProviderCard('Deepgram', ttsModel === 'deepgram', () => setTtsModel('deepgram'), 'https://cdn.simpleicons.org/deepgram/000000')}
                  {renderProviderCard('Rime', ttsModel === 'rime', () => setTtsModel('rime'))}
                  {renderProviderCard('Inworld', ttsModel === 'inworld', () => setTtsModel('inworld'))}
                  {renderProviderCard('xAI', ttsModel === 'xai', () => setTtsModel('xai'))}
                </div>
                
                <div style={{marginTop: '32px'}}>
                  {ttsModel && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          {renderLabelWithTooltip('Model', 'The AI model that converts text responses into human-like spoken audio. Different models offer different levels of realism.')}
                          <select className="form-select">
                            {TTS_PROVIDERS[ttsModel]?.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          {renderLabelWithTooltip('Voice', 'Choose the "personality" or character voice of your agent. You can select from various male, female, or neutral tones.')}
                          <select className="form-select" value={ttsVoiceId} onChange={(e) => setTtsVoiceId(e.target.value)}>
                            {TTS_PROVIDERS[ttsModel]?.voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          {renderLabelWithTooltip('Language', 'The language your agent will use when responding to users.')}
                          <select className="form-select">
                            {TTS_PROVIDERS[ttsModel]?.languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                          </select>
                        </div>
                      </div>
                      {ttsVoiceId === 'custom' && (
                        <div className="form-group">
                          {renderLabelWithTooltip('Custom Voice ID', 'If you\'ve created a custom voice clone in your provider\'s dashboard, enter its unique identifier here.')}
                          <input type="text" className="form-input" placeholder="Enter custom voice ID" />
                        </div>
                      )}
                      <div className="form-group">
                        {renderLabelWithTooltip(`${ttsModel.charAt(0).toUpperCase() + ttsModel.slice(1)} API Key`, `Get your API key from the ${ttsModel} dashboard`)}
                        <input type="password" className="form-input" placeholder="Enter API Key" value={ttsKey} onChange={(e) => setTtsKey(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {setupStep === 5 && (
              <div>
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'grid', gap: '24px' }}>
                    {/* Top Level Non-Dropdown Settings */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
                      {/* Text Output */}
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>Text Output</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input 
                            type="checkbox" 
                            id="setup-text-output-toggle"
                            checked={textOutputEnabled} 
                            onChange={(e) => setTextOutputEnabled(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                          />
                          {renderLabelWithTooltip('Text Output / Transcription', 'Displays a real-time text version of everything the user and agent say.')}
                        </div>
                      </div>

                      {/* User Interaction & Timing Config */}
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>User Interaction & Timing</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input 
                                type="checkbox" 
                                id="setup-user-away-toggle"
                                checked={userAwayTimeoutEnabled} 
                                onChange={(e) => setUserAwayTimeoutEnabled(e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                              />
                              {renderLabelWithTooltip('User Away Timeout', 'The amount of time to wait before the agent assumes the user has left the conversation if no audio is detected.')}
                            </div>
                            {userAwayTimeoutEnabled && (
                              <div className="form-group" style={{ margin: 0, maxWidth: '150px', marginLeft: '26px' }}>
                                <div style={{ position: 'relative' }}>
                                  <input 
                                    type="number" 
                                    className="form-input" 
                                    style={{ paddingRight: '30px' }}
                                    value={userAwayTimeout} 
                                    onChange={(e) => setUserAwayTimeout(parseInt(e.target.value))} 
                                  />
                                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8' }}>s</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input 
                                type="checkbox" 
                                id="setup-min-consecutive-speech-toggle"
                                checked={minConsecutiveSpeechDelayEnabled} 
                                onChange={(e) => setMinConsecutiveSpeechDelayEnabled(e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                              />
                              {renderLabelWithTooltip('Min Consecutive Speech Delay', 'Controls how long the agent waits before it starts speaking, specifically to avoid the agent immediately talking over the user if the user pauses mid-thought very briefly.')}
                            </div>
                            {minConsecutiveSpeechDelayEnabled && (
                              <div className="form-group" style={{ margin: 0, maxWidth: '150px', marginLeft: '26px' }}>
                                <div style={{ position: 'relative' }}>
                                  <input 
                                    type="number" 
                                    className="form-input" 
                                    style={{ paddingRight: '35px' }}
                                    value={minConsecutiveSpeechDelay} 
                                    onChange={(e) => setMinConsecutiveSpeechDelay(parseInt(e.target.value))} 
                                  />
                                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8' }}>ms</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Session Cleanup & Lifecycle Config */}
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '12px', marginTop: 0 }}>Session Cleanup & Lifecycle</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input 
                                type="checkbox" 
                                id="setup-close-on-disconnect-toggle"
                                checked={closeOnDisconnect} 
                                onChange={(e) => setCloseOnDisconnect(e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                              />
                              {renderLabelWithTooltip('Close on Participant Disconnect', 'If enabled, the agent service will automatically shut down as soon as the user leaves.')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Advanced Settings */}
                    <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', letterSpacing: '0.05em' }}>
                            Advanced Settings
                          </div>
                          <span style={{ padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px', color: '#475569', fontWeight: 600 }}>Configure</span>
                        </div>
                        <button 
                          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                          style={{ padding: '6px 12px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}
                        >
                          <Settings size={14} /> Configure
                        </button>
                      </div>
                      
                      {showAdvancedSettings && (
                        <div style={{ marginTop: '24px', display: 'grid', gap: '24px' }}>
                          {/* VAD Config */}
                          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', margin: '0 0 16px 0' }}>Voice Activity Detection (VAD)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Min Speech Duration (s)', 'The minimum amount of time (in seconds) that a sound must last to be recognized as human speech. This helps filter out short background noises.')}
                                <input type="number" step="0.01" className="form-input" value={vadMinSpeechDuration} onChange={(e) => setVadMinSpeechDuration(parseFloat(e.target.value))} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Min Silence Duration (s)', 'The duration of silence (in seconds) required to determine that a person has finished speaking. A higher value allows for longer natural pauses during speech.')}
                                <input type="number" step="0.01" className="form-input" value={vadMinSilenceDuration} onChange={(e) => setVadMinSilenceDuration(parseFloat(e.target.value))} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Prefix Padding Duration (s)', 'The amount of audio (in seconds) captured BEFORE the speech was officially detected. This ensures the beginning of the first word isn\'t accidentally cut off.')}
                                <input type="number" step="0.01" className="form-input" value={vadPrefixPaddingDuration} onChange={(e) => setVadPrefixPaddingDuration(parseFloat(e.target.value))} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Activation Threshold', 'The confidence level (0 to 1) required to trigger speech detection. A higher value makes the agent less likely to be triggered by faint background noise.')}
                                <input type="number" step="0.01" className="form-input" value={vadActivationThreshold} onChange={(e) => setVadActivationThreshold(parseFloat(e.target.value))} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Deactivation Threshold', 'The confidence level (0 to 1) below which speech is considered to have ended. This is usually lower than the activation threshold to avoid cutting off mid-sentence.')}
                                <input type="number" step="0.01" className="form-input" value={vadDeactivationThreshold} onChange={(e) => setVadDeactivationThreshold(parseFloat(e.target.value))} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Max Buffered Speech (s)', 'The maximum length of audio (in seconds) the agent will store in its temporary memory while waiting to process it.')}
                                <input type="number" step="0.1" className="form-input" value={vadMaxBufferedSpeech} onChange={(e) => setVadMaxBufferedSpeech(parseFloat(e.target.value))} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                {renderLabelWithTooltip('Sample Rate (Hz)', 'The number of audio samples processed per second. 16,000 Hz (16kHz) is standard for most speech-to-text models for high quality.')}
                                <input type="number" className="form-input" value={vadSampleRate} onChange={(e) => setVadSampleRate(parseInt(e.target.value))} />
                              </div>
                              <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {renderLabelWithTooltip('Noise Cancellation', 'Automatically filters out background noise like fans or static to improve speech recognition quality.')}
                                <input type="checkbox" checked={noiseCancellationEnabled} onChange={(e) => setNoiseCancellationEnabled(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} />
                              </div>
                            </div>
                          </div>

                          {/* Turn Detection & Interruptions Config */}
                          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#475569', margin: '0 0 16px 0' }}>Turn Detection & Interruptions</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              
                              {/* Turn Detection Section */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <input 
                                    type="checkbox" 
                                    id="setup-turn-detection-toggle"
                                    checked={turnDetectionEnabled} 
                                    onChange={(e) => setTurnDetectionEnabled(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                                  />
                                  {renderLabelWithTooltip('Turn Detection', 'Automatically identifies when a user has finished their sentence so the agent knows exactly when to start responding.')}
                                </div>
                                
                                {turnDetectionEnabled && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '26px' }}>
                                    {[
                                      { id: 'adaptive', label: 'Turn Detector Model - MultilingualModel' },
                                      { id: 'vad', label: 'VAD Only' },
                                      { id: 'stt', label: 'STT Endpointing' },
                                    ].map(mode => (
                                      <button
                                        key={mode.id}
                                        onClick={() => setTurnDetectionMode(mode.id as any)}
                                        style={{
                                          padding: '6px 14px',
                                          borderRadius: '20px',
                                          fontSize: '12px',
                                          fontWeight: 500,
                                          border: '1px solid',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          backgroundColor: turnDetectionMode === mode.id ? '#eff6ff' : 'white',
                                          borderColor: turnDetectionMode === mode.id ? '#3b82f6' : '#e2e8f0',
                                          color: turnDetectionMode === mode.id ? '#2563eb' : '#64748b'
                                        }}
                                      >
                                        {mode.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }}></div>

                              {/* Interruptions Section */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input 
                                      type="checkbox" 
                                      id="setup-barge-in-toggle"
                                      checked={bargeInEnabled} 
                                      onChange={(e) => setBargeInEnabled(e.target.checked)}
                                      style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                                    />
                                    {renderLabelWithTooltip('Barge-in / Interruptions', 'When enabled, the user can speak while the agent is talking, and the agent will immediately stop to listen.')}
                                  </div>
                                  
                                  {bargeInEnabled && (
                                    <div style={{ marginLeft: '26px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                      <div className="form-group" style={{ margin: 0 }}>
                                        {renderLabelWithTooltip('Mode', 'The method used to detect interruptions. \'Adaptive\' is usually best as it learns to distinguish between noise and real speech.')}
                                        <select 
                                          className="form-select" 
                                          style={{ height: '32px', fontSize: '12px', padding: '0 8px' }}
                                          value={bargeInMode}
                                          onChange={(e) => setBargeInMode(e.target.value as any)}
                                        >
                                          <option value="adaptive">Adaptive</option>
                                          <option value="vad">VAD Only</option>
                                        </select>
                                      </div>
                                      <div className="form-group" style={{ margin: 0 }}>
                                        {renderLabelWithTooltip('Min Duration (s)', 'How long the user must speak (in seconds) before the agent considers it a real interruption.')}
                                        <input 
                                          type="number" 
                                          step="0.1"
                                          className="form-input" 
                                          style={{ height: '32px', fontSize: '12px', padding: '0 8px', width: '100%' }}
                                          value={bargeInMinDuration}
                                          onChange={(e) => setBargeInMinDuration(parseFloat(e.target.value))}
                                        />
                                      </div>
                                      <div className="form-group" style={{ margin: 0 }}>
                                        {renderLabelWithTooltip('Min Words', 'The minimum number of words the user must say to successfully interrupt the agent.')}
                                        <input 
                                          type="number" 
                                          className="form-input" 
                                          style={{ height: '32px', fontSize: '12px', padding: '0 8px', width: '100%' }}
                                          value={bargeInMinWords}
                                          onChange={(e) => setBargeInMinWords(parseInt(e.target.value))}
                                        />
                                      </div>
                                      <div style={{ gridColumn: 'span 3', marginTop: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <input 
                                            type="checkbox" 
                                            id="setup-discard-audio-toggle"
                                            checked={discardAudioIfUninterruptible} 
                                            onChange={(e) => setDiscardAudioIfUninterruptible(e.target.checked)}
                                            style={{ width: '14px', height: '14px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                                          />
                                          {renderLabelWithTooltip('Discard Audio if Uninterruptible', 'If the agent is in a critical non-stop phase, this determines if it should completely ignore user speech.')}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input 
                                      type="checkbox" 
                                      id="setup-endpointing-toggle"
                                      checked={endpointingDelayEnabled} 
                                      onChange={(e) => setEndpointingDelayEnabled(e.target.checked)}
                                      style={{ width: '16px', height: '16px', accentColor: 'var(--wso2-blue)', cursor: 'pointer' }} 
                                    />
                                    {renderLabelWithTooltip('Endpointing Delay', 'The strategy used to decide exactly how long to wait after the user stops speaking before responding.')}
                                  </div>
                                  
                                  {endpointingDelayEnabled && (
                                    <div style={{ marginLeft: '26px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                      <div className="form-group" style={{ margin: 0 }}>
                                        {renderLabelWithTooltip('Mode', '\'Fixed\' uses a constant wait time, while \'Dynamic\' adjusts the wait time automatically based on how the user is speaking.')}
                                        <select 
                                          className="form-select" 
                                          style={{ height: '32px', fontSize: '12px', padding: '0 8px' }}
                                          value={endpointingDelayMode}
                                          onChange={(e) => setEndpointingDelayMode(e.target.value as any)}
                                        >
                                          <option value="dynamic">Dynamic</option>
                                          <option value="fixed">Fixed</option>
                                        </select>
                                      </div>
                                      <div className="form-group" style={{ margin: 0 }}>
                                        {renderLabelWithTooltip('Min Delay (ms)', 'The minimum time (in milliseconds) the agent must wait after speech stops.')}
                                        <input 
                                          type="number" 
                                          className="form-input" 
                                          style={{ height: '32px', fontSize: '12px', padding: '0 8px', width: '100%' }}
                                          value={endpointingMinDelay}
                                          onChange={(e) => setEndpointingMinDelay(parseInt(e.target.value))}
                                        />
                                      </div>
                                      <div className="form-group" style={{ margin: 0 }}>
                                        {renderLabelWithTooltip('Max Delay (ms)', 'The maximum time (in milliseconds) the agent will wait before it MUST generate a response.')}
                                        <input 
                                          type="number" 
                                          className="form-input" 
                                          style={{ height: '32px', fontSize: '12px', padding: '0 8px', width: '100%' }}
                                          value={endpointingMaxDelay}
                                          onChange={(e) => setEndpointingMaxDelay(parseInt(e.target.value))}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </div>

                <div className="form-group">
                  {!isDeploying && !isDeployed && (
                    <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
                      Your voice agent is fully configured. Click Deploy below to provision the service on the WSO2 Integration Platform.
                    </p>
                  )}

                  {isDeploying && (
                    <div style={{ padding: '24px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <Loader2 size={24} color="var(--wso2-blue)" className="spinner" />
                      <div>
                        <div style={{ fontWeight: 500, color: '#1e293b', marginBottom: '4px' }}>Deploying Service</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Provisioning resources and starting your agent...</div>
                      </div>
                    </div>
                  )}

                  {isDeployed && (
                    <div style={{ padding: '24px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ backgroundColor: '#16a34a', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={16} />
                        </div>
                        <h3 style={{ margin: 0, color: '#166534', fontSize: '16px' }}>Deployment Successful</h3>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="setup-actions">
              {setupStep > 1 && !isDeploying && !isDeployed && (
                <button className="secondary-btn" onClick={handlePrevStep}>Back</button>
              )}
              
              {setupStep < 5 && (
                <button className={`primary-btn ${isStepValid() ? 'deploy-btn' : ''}`} onClick={handleNextStep}>Next</button>
              )}

              {setupStep === 5 && !isDeployed && (
                <button className="primary-btn deploy-btn" onClick={handleDeploy} disabled={isDeploying} style={{ opacity: isDeploying ? 0.7 : 1 }}>
                  {isDeploying ? 'Deploying...' : 'Deploy'}
                </button>
              )}
            </div>
          </div>
            </>
          ) : (
            <div className="services-list-container" style={{ padding: '32px 48px', flex: 1, overflowY: 'auto', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Voice AI Agents</h1>
                {services.length > 0 && (
                  <button className="primary-btn deploy-btn" onClick={() => setView('setup')}>Create New +</button>
                )}
              </div>
              
              {services.length === 0 ? (
                <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: '#f8fafc', borderRadius: '8px', padding: '64px 24px' }}>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', alignItems: 'center' }}>
                    <div style={{ width: '80px', height: '80px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', transform: 'rotate(-10deg)', zIndex: 1 }}>
                      <img src="https://cdn.simpleicons.org/deepgram/000000" alt="Deepgram" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    </div>
                     <div style={{ width: '100px', height: '100px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.12)', zIndex: 2 }}>
                        <LiveKitLogo size={48} color="var(--wso2-blue)" />
                     </div>
                    <div style={{ width: '80px', height: '80px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', transform: 'rotate(10deg)', zIndex: 1 }}>
                      <img src="https://cdn.simpleicons.org/elevenlabs/000000" alt="ElevenLabs" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    </div>
                  </div>
                  
                  <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b', marginBottom: '12px', textAlign: 'center', maxWidth: '650px' }}>
                    Create Fully-Functional Voice AI agents With WSO2 Integration Platform-Managed Agents
                  </h2>
                  <p style={{ color: '#64748b', marginBottom: '32px', textAlign: 'center', fontSize: '14px' }}>
                    No voice AI services have been created yet.
                  </p>
                  
                  <button className="primary-btn deploy-btn" onClick={() => setView('setup')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 500 }}>+</span> Create
                  </button>
                </div>
              ) : (
                <div className="services-table-container" style={{ marginTop: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '0 24px 8px', fontWeight: 600 }}>Name</th>
                        <th style={{ padding: '0 24px 8px', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '0 24px 8px', fontWeight: 600 }}>Source Project</th>
                        <th style={{ padding: '0 24px 8px', fontWeight: 600 }}>Cloud/Region</th>
                        <th style={{ padding: '0 24px 8px', fontWeight: 600 }}>STT/TTS Models</th>
                        <th style={{ padding: '0 24px 8px', fontWeight: 600, textAlign: 'right' }}>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service, index) => (
                        <tr 
                          key={index} 
                          onClick={() => handleAgentClick(service)}
                          className="table-row-hover" 
                          style={{ backgroundColor: 'white', transition: 'all 0.2s', cursor: 'pointer' }}
                        >
                          <td style={{ padding: '18px 24px', borderRadius: '8px 0 0 8px', border: '1px solid #e2e8f0', borderRight: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wso2-blue)' }}>
                                <LiveKitLogo size={20} color="var(--wso2-blue)" />
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>{service.displayName || service.serviceName}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{service.serviceName}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '18px 24px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', border: '1px solid #dcfce7' }}>
                              Running
                            </div>
                          </td>
                          <td style={{ padding: '18px 24px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: 'var(--wso2-blue)', fontSize: '14px', fontWeight: 500 }}>
                            sample-agent
                          </td>
                          <td style={{ padding: '18px 24px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>
                            Digital Ocean - US East
                          </td>
                          <td style={{ padding: '18px 24px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#475569', backgroundColor: '#f8fafc', padding: '2px 8px', borderRadius: '4px', border: '1px solid #f1f5f9', textTransform: 'uppercase', fontWeight: 600 }}>{service.sttModel}</span>
                              <span style={{ fontSize: '12px', color: '#475569', backgroundColor: '#f8fafc', padding: '2px 8px', borderRadius: '4px', border: '1px solid #f1f5f9', textTransform: 'uppercase', fontWeight: 600 }}>{service.ttsModel}</span>
                            </div>
                          </td>
                          <td style={{ padding: '18px 24px', borderRadius: '0 8px 8px 0', border: '1px solid #e2e8f0', borderLeft: 'none', textAlign: 'right', color: '#64748b', fontSize: '13px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <Clock size={14} /> Just now
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
