'use client';

import {
  Settings as SettingsIcon,
  ArrowLeft,
  Loader2,
  Info,
  Trash2,
  Edit3,
  PlusCircle,
  Save,
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@headlessui/react';
import ThemeSwitcher from '@/components/theme/Switcher';
import { ImagesIcon, VideoIcon, Layers3 } from 'lucide-react';
import Link from 'next/link';
import { PROVIDER_METADATA } from '@/lib/providers';
import Optimization from '@/components/MessageInputActions/Optimization';
import ModelSelector from '@/components/MessageInputActions/ModelSelector';

interface SettingsType {
  chatModelProviders: {
    [key: string]: [Record<string, any>];
  };
  embeddingModelProviders: {
    [key: string]: [Record<string, any>];
  };
  openaiApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  ollamaApiUrl: string;
  lmStudioApiUrl: string;
  deepseekApiKey: string;
  aimlApiKey: string;
  customOpenaiApiKey: string;
  customOpenaiApiUrl: string;
  customOpenaiModelName: string;
  ollamaContextWindow: number;
  hiddenModels: string[];
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isSaving?: boolean;
  onSave?: (value: string) => void;
}

const InputComponent = ({
  className,
  isSaving,
  onSave,
  ...restProps
}: InputProps) => {
  return (
    <div className="relative">
      <input
        {...restProps}
        className={cn(
          'bg-light-secondary dark:bg-dark-secondary w-full px-3 py-2 flex items-center overflow-hidden border border-light-200 dark:border-dark-200 dark:text-white rounded-lg text-sm',
          isSaving && 'pr-10',
          className,
        )}
        onBlur={(e) => onSave?.(e.target.value)}
      />
      {isSaving && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2
            size={16}
            className="animate-spin text-black/70 dark:text-white/70"
          />
        </div>
      )}
    </div>
  );
};

interface TextareaProps extends React.InputHTMLAttributes<HTMLTextAreaElement> {
  isSaving?: boolean;
  onSave?: (value: string) => void;
}

const TextareaComponent = ({
  className,
  isSaving,
  onSave,
  ...restProps
}: TextareaProps) => {
  return (
    <div className="relative">
      <textarea
        placeholder="Any special instructions for the LLM"
        className="placeholder:text-sm text-sm w-full flex items-center justify-between p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 transition-colors"
        rows={4}
        onBlur={(e) => onSave?.(e.target.value)}
        {...restProps}
      />
      {isSaving && (
        <div className="absolute right-3 top-3">
          <Loader2
            size={16}
            className="animate-spin text-black/70 dark:text-white/70"
          />
        </div>
      )}
    </div>
  );
};

const Select = ({
  className,
  options,
  ...restProps
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string; disabled?: boolean }[];
}) => {
  return (
    <select
      {...restProps}
      className={cn(
        'bg-light-secondary dark:bg-dark-secondary px-3 py-2 flex items-center overflow-hidden border border-light-200 dark:border-dark-200 dark:text-white rounded-lg text-sm',
        className,
      )}
    >
      {options.map(({ label, value, disabled }) => (
        <option key={value} value={value} disabled={disabled}>
          {label}
        </option>
      ))}
    </select>
  );
};

const SettingsSection = ({
  title,
  children,
  tooltip,
}: {
  title: string;
  children: React.ReactNode;
  tooltip?: string;
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex flex-col space-y-4 p-4 bg-light-secondary/50 dark:bg-dark-secondary/50 rounded-xl border border-light-200 dark:border-dark-200">
      <div className="flex items-center gap-2">
        <h2 className="text-black/90 dark:text-white/90 font-medium">
          {title}
        </h2>
        {tooltip && (
          <div className="relative">
            <button
              ref={buttonRef}
              className="p-1 text-black/70 dark:text-white/70 rounded-full hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
              onClick={() => setShowTooltip(!showTooltip)}
              aria-label="Show section information"
            >
              <Info size={16} />
            </button>
            {showTooltip && (
              <div
                ref={tooltipRef}
                className="absolute z-10 left-6 top-0 w-96 rounded-md shadow-lg bg-white dark:bg-dark-secondary border border-light-200 dark:border-dark-200"
              >
                <div className="py-2 px-3">
                  <div className="space-y-1 text-xs text-black dark:text-white">
                    {tooltip.split('\\n').map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
};

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  type: 'system' | 'persona';
}

export default function SettingsPage() {
  const [config, setConfig] = useState<SettingsType | null>(null);
  const [chatModels, setChatModels] = useState<Record<string, any>>({});
  const [embeddingModels, setEmbeddingModels] = useState<Record<string, any>>(
    {},
  );
  const [selectedChatModelProvider, setSelectedChatModelProvider] = useState<
    string | null
  >(null);
  const [selectedChatModel, setSelectedChatModel] = useState<string | null>(
    null,
  );
  const [selectedEmbeddingModelProvider, setSelectedEmbeddingModelProvider] =
    useState<string | null>(null);
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [automaticSuggestions, setAutomaticSuggestions] = useState(true);
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C');
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [contextWindowSize, setContextWindowSize] = useState(2048);
  const [isCustomContextWindow, setIsCustomContextWindow] = useState(false);
  const predefinedContextSizes = [
    1024, 2048, 3072, 4096, 8192, 16384, 32768, 65536, 131072,
  ];

  const [userSystemPrompts, setUserSystemPrompts] = useState<SystemPrompt[]>(
    [],
  );
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [newPromptType, setNewPromptType] = useState<'system' | 'persona'>(
    'system',
  );
  const [isAddingNewPrompt, setIsAddingNewPrompt] = useState(false);

  // Model visibility state variables
  const [allModels, setAllModels] = useState<{
    chat: Record<string, Record<string, any>>;
    embedding: Record<string, Record<string, any>>;
  }>({ chat: {}, embedding: {} });
  const [hiddenModels, setHiddenModels] = useState<string[]>([]);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );

  // Default Search Settings state variables
  const [searchOptimizationMode, setSearchOptimizationMode] =
    useState<string>('');
  const [searchChatModelProvider, setSearchChatModelProvider] =
    useState<string>('');
  const [searchChatModel, setSearchChatModel] = useState<string>('');

  useEffect(() => {
    const fetchConfig = async () => {
      const res = await fetch(`/api/config`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = (await res.json()) as SettingsType;

      setConfig(data);

      // Populate hiddenModels state from config
      setHiddenModels(data.hiddenModels || []);

      const chatModelProvidersKeys = Object.keys(data.chatModelProviders || {});
      const embeddingModelProvidersKeys = Object.keys(
        data.embeddingModelProviders || {},
      );

      const defaultChatModelProvider =
        chatModelProvidersKeys.length > 0 ? chatModelProvidersKeys[0] : '';
      const defaultEmbeddingModelProvider =
        embeddingModelProvidersKeys.length > 0
          ? embeddingModelProvidersKeys[0]
          : '';

      const chatModelProvider =
        localStorage.getItem('chatModelProvider') ||
        defaultChatModelProvider ||
        '';
      const chatModel =
        localStorage.getItem('chatModel') ||
        (data.chatModelProviders &&
        data.chatModelProviders[chatModelProvider]?.length > 0
          ? data.chatModelProviders[chatModelProvider][0].name
          : undefined) ||
        '';
      const embeddingModelProvider =
        localStorage.getItem('embeddingModelProvider') ||
        defaultEmbeddingModelProvider ||
        '';
      const embeddingModel =
        localStorage.getItem('embeddingModel') ||
        (data.embeddingModelProviders &&
          data.embeddingModelProviders[embeddingModelProvider]?.[0].name) ||
        '';

      setSelectedChatModelProvider(chatModelProvider);
      setSelectedChatModel(chatModel);
      setSelectedEmbeddingModelProvider(embeddingModelProvider);
      setSelectedEmbeddingModel(embeddingModel);
      setChatModels(data.chatModelProviders || {});
      setEmbeddingModels(data.embeddingModelProviders || {});

      setAutomaticSuggestions(
        localStorage.getItem('autoSuggestions') !== 'false', // default to true if not set
      );
      const storedContextWindow = parseInt(
        localStorage.getItem('ollamaContextWindow') ?? '2048',
      );
      setContextWindowSize(storedContextWindow);
      setIsCustomContextWindow(
        !predefinedContextSizes.includes(storedContextWindow),
      );

      setTemperatureUnit(localStorage.getItem('temperatureUnit')! as 'C' | 'F');

      setIsLoading(false);
    };

    const fetchAllModels = async () => {
      try {
        // Fetch complete model list including hidden models
        const res = await fetch(`/api/models?include_hidden=true`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          setAllModels({
            chat: data.chatModelProviders || {},
            embedding: data.embeddingModelProviders || {},
          });
        }
      } catch (error) {
        console.error('Failed to fetch all models:', error);
      }
    };

    fetchConfig();
    fetchAllModels();

    // Load search settings from localStorage
    const loadSearchSettings = () => {
      const storedSearchOptimizationMode = localStorage.getItem(
        'searchOptimizationMode',
      );
      const storedSearchChatModelProvider = localStorage.getItem(
        'searchChatModelProvider',
      );
      const storedSearchChatModel = localStorage.getItem('searchChatModel');

      if (storedSearchOptimizationMode) {
        setSearchOptimizationMode(storedSearchOptimizationMode);
      }
      if (storedSearchChatModelProvider) {
        setSearchChatModelProvider(storedSearchChatModelProvider);
      }
      if (storedSearchChatModel) {
        setSearchChatModel(storedSearchChatModel);
      }
    };

    loadSearchSettings();

    const fetchSystemPrompts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/system-prompts');
        if (response.ok) {
          const prompts = await response.json();
          setUserSystemPrompts(prompts);
        } else {
          console.error('Failed to load system prompts.');
        }
      } catch (error) {
        console.error('Error loading system prompts.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSystemPrompts();
  }, []);

  const saveConfig = async (key: string, value: any) => {
    setSavingStates((prev) => ({ ...prev, [key]: true }));

    try {
      const updatedConfig = {
        ...config,
        [key]: value,
      } as SettingsType;

      const response = await fetch(`/api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to update config');
      }

      setConfig(updatedConfig);

      if (
        key.toLowerCase().includes('api') ||
        key.toLowerCase().includes('url')
      ) {
        const res = await fetch(`/api/config`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch updated config');
        }

        const data = await res.json();

        setChatModels(data.chatModelProviders || {});
        setEmbeddingModels(data.embeddingModelProviders || {});

        const currentChatProvider = selectedChatModelProvider;
        const newChatProviders = Object.keys(data.chatModelProviders || {});

        if (!currentChatProvider && newChatProviders.length > 0) {
          const firstProvider = newChatProviders[0];
          const firstModel = data.chatModelProviders[firstProvider]?.[0]?.name;

          if (firstModel) {
            setSelectedChatModelProvider(firstProvider);
            setSelectedChatModel(firstModel);
            localStorage.setItem('chatModelProvider', firstProvider);
            localStorage.setItem('chatModel', firstModel);
          }
        } else if (
          currentChatProvider &&
          (!data.chatModelProviders ||
            !data.chatModelProviders[currentChatProvider] ||
            !Array.isArray(data.chatModelProviders[currentChatProvider]) ||
            data.chatModelProviders[currentChatProvider].length === 0)
        ) {
          const firstValidProvider = Object.entries(
            data.chatModelProviders || {},
          ).find(
            ([_, models]) => Array.isArray(models) && models.length > 0,
          )?.[0];

          if (firstValidProvider) {
            setSelectedChatModelProvider(firstValidProvider);
            setSelectedChatModel(
              data.chatModelProviders[firstValidProvider][0].name,
            );
            localStorage.setItem('chatModelProvider', firstValidProvider);
            localStorage.setItem(
              'chatModel',
              data.chatModelProviders[firstValidProvider][0].name,
            );
          } else {
            setSelectedChatModelProvider(null);
            setSelectedChatModel(null);
            localStorage.removeItem('chatModelProvider');
            localStorage.removeItem('chatModel');
          }
        }

        const currentEmbeddingProvider = selectedEmbeddingModelProvider;
        const newEmbeddingProviders = Object.keys(
          data.embeddingModelProviders || {},
        );

        if (!currentEmbeddingProvider && newEmbeddingProviders.length > 0) {
          const firstProvider = newEmbeddingProviders[0];
          const firstModel =
            data.embeddingModelProviders[firstProvider]?.[0]?.name;

          if (firstModel) {
            setSelectedEmbeddingModelProvider(firstProvider);
            setSelectedEmbeddingModel(firstModel);
            localStorage.setItem('embeddingModelProvider', firstProvider);
            localStorage.setItem('embeddingModel', firstModel);
          }
        } else if (
          currentEmbeddingProvider &&
          (!data.embeddingModelProviders ||
            !data.embeddingModelProviders[currentEmbeddingProvider] ||
            !Array.isArray(
              data.embeddingModelProviders[currentEmbeddingProvider],
            ) ||
            data.embeddingModelProviders[currentEmbeddingProvider].length === 0)
        ) {
          const firstValidProvider = Object.entries(
            data.embeddingModelProviders || {},
          ).find(
            ([_, models]) => Array.isArray(models) && models.length > 0,
          )?.[0];

          if (firstValidProvider) {
            setSelectedEmbeddingModelProvider(firstValidProvider);
            setSelectedEmbeddingModel(
              data.embeddingModelProviders[firstValidProvider][0].name,
            );
            localStorage.setItem('embeddingModelProvider', firstValidProvider);
            localStorage.setItem(
              'embeddingModel',
              data.embeddingModelProviders[firstValidProvider][0].name,
            );
          } else {
            setSelectedEmbeddingModelProvider(null);
            setSelectedEmbeddingModel(null);
            localStorage.removeItem('embeddingModelProvider');
            localStorage.removeItem('embeddingModel');
          }
        }

        setConfig(data);
      }

      if (key === 'automaticSuggestions') {
        localStorage.setItem('autoSuggestions', value.toString());
      } else if (key === 'chatModelProvider') {
        localStorage.setItem('chatModelProvider', value);
      } else if (key === 'chatModel') {
        localStorage.setItem('chatModel', value);
      } else if (key === 'embeddingModelProvider') {
        localStorage.setItem('embeddingModelProvider', value);
      } else if (key === 'embeddingModel') {
        localStorage.setItem('embeddingModel', value);
      } else if (key === 'ollamaContextWindow') {
        localStorage.setItem('ollamaContextWindow', value.toString());
      } else if (key === 'temperatureUnit') {
        localStorage.setItem('temperatureUnit', value.toString());
      }
    } catch (err) {
      console.error('Failed to save:', err);
      setConfig((prev) => ({ ...prev! }));
    } finally {
      setTimeout(() => {
        setSavingStates((prev) => ({ ...prev, [key]: false }));
      }, 500);
    }
  };

  const saveSearchSetting = (key: string, value: string) => {
    localStorage.setItem(key, value);
  };

  const handleModelVisibilityToggle = async (
    modelKey: string,
    isVisible: boolean,
  ) => {
    let updatedHiddenModels: string[];

    if (isVisible) {
      // Model should be visible, remove from hidden list
      updatedHiddenModels = hiddenModels.filter((m) => m !== modelKey);
    } else {
      // Model should be hidden, add to hidden list
      updatedHiddenModels = [...hiddenModels, modelKey];
    }

    // Update local state immediately
    setHiddenModels(updatedHiddenModels);

    // Persist changes to backend
    try {
      await saveConfig('hiddenModels', updatedHiddenModels);
    } catch (error) {
      console.error('Failed to save hidden models:', error);
      // Revert local state on error
      setHiddenModels(hiddenModels);
    }
  };

  const toggleProviderExpansion = (providerId: string) => {
    setExpandedProviders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(providerId)) {
        newSet.delete(providerId);
      } else {
        newSet.add(providerId);
      }
      return newSet;
    });
  };

  const handleAddOrUpdateSystemPrompt = async () => {
    const currentPrompt = editingPrompt || {
      name: newPromptName,
      content: newPromptContent,
      type: newPromptType,
    };
    if (!currentPrompt.name.trim() || !currentPrompt.content.trim()) {
      console.error('Prompt name and content cannot be empty.');
      return;
    }

    const url = editingPrompt
      ? `/api/system-prompts/${editingPrompt.id}`
      : '/api/system-prompts';
    const method = editingPrompt ? 'PUT' : 'POST';
    const body = JSON.stringify({
      name: currentPrompt.name,
      content: currentPrompt.content,
      type: currentPrompt.type,
    });

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (response.ok) {
        const savedPrompt = await response.json();
        if (editingPrompt) {
          setUserSystemPrompts(
            userSystemPrompts.map((p) =>
              p.id === savedPrompt.id ? savedPrompt : p,
            ),
          );
          setEditingPrompt(null);
        } else {
          setUserSystemPrompts([...userSystemPrompts, savedPrompt]);
          setNewPromptName('');
          setNewPromptContent('');
          setNewPromptType('system');
          setIsAddingNewPrompt(false);
        }
        console.log(`System prompt ${editingPrompt ? 'updated' : 'added'}.`);
      } else {
        const errorData = await response.json();
        console.error(
          errorData.error ||
            `Failed to ${editingPrompt ? 'update' : 'add'} prompt.`,
        );
      }
    } catch (error) {
      console.error(`Error ${editingPrompt ? 'updating' : 'adding'} prompt.`);
    }
  };

  const handleDeleteSystemPrompt = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    try {
      const response = await fetch(`/api/system-prompts/${promptId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setUserSystemPrompts(
          userSystemPrompts.filter((p) => p.id !== promptId),
        );
        console.log('System prompt deleted.');
      } else {
        const errorData = await response.json();
        console.error(errorData.error || 'Failed to delete prompt.');
      }
    } catch (error) {
      console.error('Error deleting prompt.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col pt-4">
        <div className="flex items-center space-x-2">
          <Link href="/" className="lg:hidden">
            <ArrowLeft className="text-black/70 dark:text-white/70" />
          </Link>
          <div className="flex flex-row space-x-0.5 items-center">
            <SettingsIcon size={23} />
            <h1 className="text-3xl font-medium p-2">Settings</h1>
          </div>
        </div>
        <hr className="border-t border-[#2B2C2C] my-4 w-full" />
      </div>

      {isLoading ? (
        <div className="flex flex-row items-center justify-center min-h-[50vh]">
          <svg
            aria-hidden="true"
            className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>
        </div>
      ) : (
        config && (
          <div className="flex flex-col space-y-6 pb-28 lg:pb-8">
            <SettingsSection title="Preferences">
              <div className="flex flex-col space-y-1">
                <p className="text-black/70 dark:text-white/70 text-sm">
                  Theme
                </p>
                <ThemeSwitcher />
              </div>
              <div className="flex flex-col space-y-1">
                <p className="text-black/70 dark:text-white/70 text-sm">
                  Temperature Unit
                </p>
                <Select
                  value={temperatureUnit ?? undefined}
                  onChange={(e) => {
                    setTemperatureUnit(e.target.value as 'C' | 'F');
                    saveConfig('temperatureUnit', e.target.value);
                  }}
                  options={[
                    {
                      label: 'Celsius',
                      value: 'C',
                    },
                    {
                      label: 'Fahrenheit',
                      value: 'F',
                    },
                  ]}
                />
              </div>
            </SettingsSection>

            <SettingsSection title="Automatic Search">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between p-3 bg-light-secondary dark:bg-dark-secondary rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-light-200 dark:bg-dark-200 rounded-lg">
                      <Layers3
                        size={18}
                        className="text-black/70 dark:text-white/70"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-black/90 dark:text-white/90 font-medium">
                        Automatic Suggestions
                      </p>
                      <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                        Automatically show related suggestions after responses
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={automaticSuggestions}
                    onChange={(checked) => {
                      setAutomaticSuggestions(checked);
                      saveConfig('automaticSuggestions', checked);
                    }}
                    className={cn(
                      automaticSuggestions
                        ? 'bg-[#24A0ED]'
                        : 'bg-light-200 dark:bg-dark-200',
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                    )}
                  >
                    <span
                      className={cn(
                        automaticSuggestions
                          ? 'translate-x-6'
                          : 'translate-x-1',
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      )}
                    />
                  </Switch>
                </div>
              </div>
            </SettingsSection>

            {/* TODO: Refactor into reusable components */}
            <SettingsSection
              title="System Prompts"
              tooltip="System prompts will be added to EVERY request in the AI model.\nUSE EXTREME CAUTION, as they can significantly alter the AI's behavior and responses.\nA typical safe prompt might be: '/no_think', to disable thinking in models that support it.\n\nProviding formatting instructions or specific behaviors could lead to unexpected results."
            >
              <div className="flex flex-col space-y-4">
                {userSystemPrompts
                  .filter((prompt) => prompt.type === 'system')
                  .map((prompt) => (
                    <div
                      key={prompt.id}
                      className="p-3 border border-light-secondary dark:border-dark-secondary rounded-md bg-light-100 dark:bg-dark-100"
                    >
                      {editingPrompt && editingPrompt.id === prompt.id ? (
                        <div className="space-y-3">
                          <InputComponent
                            type="text"
                            value={editingPrompt.name}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) =>
                              setEditingPrompt({
                                ...editingPrompt,
                                name: e.target.value,
                              })
                            }
                            placeholder="Prompt Name"
                            className="text-black dark:text-white bg-white dark:bg-dark-secondary"
                          />
                          <Select
                            value={editingPrompt.type}
                            onChange={(e) =>
                              setEditingPrompt({
                                ...editingPrompt,
                                type: e.target.value as 'system' | 'persona',
                              })
                            }
                            options={[
                              { value: 'system', label: 'System Prompt' },
                              { value: 'persona', label: 'Persona Prompt' },
                            ]}
                            className="text-black dark:text-white bg-white dark:bg-dark-secondary"
                          />
                          <TextareaComponent
                            value={editingPrompt.content}
                            onChange={(
                              e: React.ChangeEvent<HTMLTextAreaElement>,
                            ) =>
                              setEditingPrompt({
                                ...editingPrompt,
                                content: e.target.value,
                              })
                            }
                            placeholder="Prompt Content"
                            className="min-h-[100px] text-black dark:text-white bg-white dark:bg-dark-secondary"
                          />
                          <div className="flex space-x-2 justify-end">
                            <button
                              onClick={() => setEditingPrompt(null)}
                              className="px-3 py-2 text-sm rounded-md bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 text-black/80 dark:text-white/80 flex items-center gap-1.5"
                            >
                              <X size={16} />
                              Cancel
                            </button>
                            <button
                              onClick={handleAddOrUpdateSystemPrompt}
                              className="px-3 py-2 text-sm rounded-md bg-[#24A0ED] hover:bg-[#1f8cdb] text-white flex items-center gap-1.5"
                            >
                              <Save size={16} />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex-grow">
                            <h4 className="font-semibold text-black/90 dark:text-white/90">
                              {prompt.name}
                            </h4>
                            <p
                              className="text-sm text-black/70 dark:text-white/70 mt-1 whitespace-pre-wrap overflow-hidden text-ellipsis"
                              style={{
                                maxHeight: '3.6em',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {prompt.content}
                            </p>
                          </div>
                          <div className="flex space-x-1 flex-shrink-0 ml-2">
                            <button
                              onClick={() => setEditingPrompt({ ...prompt })}
                              title="Edit"
                              className="p-1.5 rounded-md hover:bg-light-200 dark:hover:bg-dark-200 text-black/70 dark:text-white/70"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteSystemPrompt(prompt.id)
                              }
                              title="Delete"
                              className="p-1.5 rounded-md hover:bg-light-200 dark:hover:bg-dark-200 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-500"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                {isAddingNewPrompt && newPromptType === 'system' && (
                  <div className="p-3 border border-dashed border-light-secondary dark:border-dark-secondary rounded-md space-y-3 bg-light-100 dark:bg-dark-100">
                    <InputComponent
                      type="text"
                      value={newPromptName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewPromptName(e.target.value)
                      }
                      placeholder="System Prompt Name"
                      className="text-black dark:text-white bg-white dark:bg-dark-secondary"
                    />
                    <TextareaComponent
                      value={newPromptContent}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setNewPromptContent(e.target.value)
                      }
                      placeholder="System prompt content (e.g., '/nothink')"
                      className="min-h-[100px] text-black dark:text-white bg-white dark:bg-dark-secondary"
                    />
                    <div className="flex space-x-2 justify-end">
                      <button
                        onClick={() => {
                          setIsAddingNewPrompt(false);
                          setNewPromptName('');
                          setNewPromptContent('');
                          setNewPromptType('system');
                        }}
                        className="px-3 py-2 text-sm rounded-md bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 text-black/80 dark:text-white/80 flex items-center gap-1.5"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                      <button
                        onClick={handleAddOrUpdateSystemPrompt}
                        className="px-3 py-2 text-sm rounded-md bg-[#24A0ED] hover:bg-[#1f8cdb] text-white flex items-center gap-1.5"
                      >
                        <Save size={16} />
                        Add System Prompt
                      </button>
                    </div>
                  </div>
                )}
                {!isAddingNewPrompt && (
                  <button
                    onClick={() => {
                      setIsAddingNewPrompt(true);
                      setNewPromptType('system');
                    }}
                    className="self-start px-3 py-2 text-sm rounded-md border border-light-200 dark:border-dark-200 hover:bg-light-200 dark:hover:bg-dark-200 text-black/80 dark:text-white/80 flex items-center gap-1.5"
                  >
                    <PlusCircle size={18} /> Add System Prompt
                  </button>
                )}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Persona Prompts"
              tooltip="Persona prompts will only be applied to the final response.\nThey can define the personality and character traits for the AI assistant.\nSuch as: 'You are a pirate that speaks in riddles.'\n\nThey could be used to provide structured output instructions\nSuch as: 'Provide answers formatted with bullet points and tables.'"
            >
              <div className="flex flex-col space-y-4">
                {userSystemPrompts
                  .filter((prompt) => prompt.type === 'persona')
                  .map((prompt) => (
                    <div
                      key={prompt.id}
                      className="p-3 border border-light-secondary dark:border-dark-secondary rounded-md bg-light-100 dark:bg-dark-100"
                    >
                      {editingPrompt && editingPrompt.id === prompt.id ? (
                        <div className="space-y-3">
                          <InputComponent
                            type="text"
                            value={editingPrompt.name}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) =>
                              setEditingPrompt({
                                ...editingPrompt,
                                name: e.target.value,
                              })
                            }
                            placeholder="Prompt Name"
                            className="text-black dark:text-white bg-white dark:bg-dark-secondary"
                          />
                          <Select
                            value={editingPrompt.type}
                            onChange={(e) =>
                              setEditingPrompt({
                                ...editingPrompt,
                                type: e.target.value as 'system' | 'persona',
                              })
                            }
                            options={[
                              { value: 'system', label: 'System Prompt' },
                              { value: 'persona', label: 'Persona Prompt' },
                            ]}
                            className="text-black dark:text-white bg-white dark:bg-dark-secondary"
                          />
                          <TextareaComponent
                            value={editingPrompt.content}
                            onChange={(
                              e: React.ChangeEvent<HTMLTextAreaElement>,
                            ) =>
                              setEditingPrompt({
                                ...editingPrompt,
                                content: e.target.value,
                              })
                            }
                            placeholder="Prompt Content"
                            className="min-h-[100px] text-black dark:text-white bg-white dark:bg-dark-secondary"
                          />
                          <div className="flex space-x-2 justify-end">
                            <button
                              onClick={() => setEditingPrompt(null)}
                              className="px-3 py-2 text-sm rounded-md bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 text-black/80 dark:text-white/80 flex items-center gap-1.5"
                            >
                              <X size={16} />
                              Cancel
                            </button>
                            <button
                              onClick={handleAddOrUpdateSystemPrompt}
                              className="px-3 py-2 text-sm rounded-md bg-[#24A0ED] hover:bg-[#1f8cdb] text-white flex items-center gap-1.5"
                            >
                              <Save size={16} />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex-grow">
                            <h4 className="font-semibold text-black/90 dark:text-white/90">
                              {prompt.name}
                            </h4>
                            <p
                              className="text-sm text-black/70 dark:text-white/70 mt-1 whitespace-pre-wrap overflow-hidden text-ellipsis"
                              style={{
                                maxHeight: '3.6em',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {prompt.content}
                            </p>
                          </div>
                          <div className="flex space-x-1 flex-shrink-0 ml-2">
                            <button
                              onClick={() => setEditingPrompt({ ...prompt })}
                              title="Edit"
                              className="p-1.5 rounded-md hover:bg-light-200 dark:hover:bg-dark-200 text-black/70 dark:text-white/70"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteSystemPrompt(prompt.id)
                              }
                              title="Delete"
                              className="p-1.5 rounded-md hover:bg-light-200 dark:hover:bg-dark-200 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-500"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                {isAddingNewPrompt && newPromptType === 'persona' && (
                  <div className="p-3 border border-dashed border-light-secondary dark:border-dark-secondary rounded-md space-y-3 bg-light-100 dark:bg-dark-100">
                    <InputComponent
                      type="text"
                      value={newPromptName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewPromptName(e.target.value)
                      }
                      placeholder="Persona Prompt Name"
                      className="text-black dark:text-white bg-white dark:bg-dark-secondary"
                    />
                    <TextareaComponent
                      value={newPromptContent}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setNewPromptContent(e.target.value)
                      }
                      placeholder="Persona prompt content (e.g., You are a helpful assistant that speaks like a pirate and uses nautical metaphors.)"
                      className="min-h-[100px] text-black dark:text-white bg-white dark:bg-dark-secondary"
                    />
                    <div className="flex space-x-2 justify-end">
                      <button
                        onClick={() => {
                          setIsAddingNewPrompt(false);
                          setNewPromptName('');
                          setNewPromptContent('');
                          setNewPromptType('system');
                        }}
                        className="px-3 py-2 text-sm rounded-md bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 text-black/80 dark:text-white/80 flex items-center gap-1.5"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                      <button
                        onClick={handleAddOrUpdateSystemPrompt}
                        className="px-3 py-2 text-sm rounded-md bg-[#24A0ED] hover:bg-[#1f8cdb] text-white flex items-center gap-1.5"
                      >
                        <Save size={16} />
                        Add Persona Prompt
                      </button>
                    </div>
                  </div>
                )}
                {!isAddingNewPrompt && (
                  <button
                    onClick={() => {
                      setIsAddingNewPrompt(true);
                      setNewPromptType('persona');
                    }}
                    className="self-start px-3 py-2 text-sm rounded-md border border-light-200 dark:border-dark-200 hover:bg-light-200 dark:hover:bg-dark-200 text-black/80 dark:text-white/80 flex items-center gap-1.5"
                  >
                    <PlusCircle size={18} /> Add Persona Prompt
                  </button>
                )}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Default Search Settings"
              tooltip='Select the settings that will be used when navigating to the site with a search query, such as "example.com/search?q=your+query".\nThese settings will override the global settings for search queries.\n\nIf settings are not specified, the global settings will be used.'
            >
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    Optimization Mode
                  </p>
                  <div className="flex justify-start items-center space-x-2">
                    <Optimization
                      optimizationMode={searchOptimizationMode}
                      setOptimizationMode={(mode) => {
                        setSearchOptimizationMode(mode);
                        saveSearchSetting('searchOptimizationMode', mode);
                      }}
                      showTitle={true}
                    />
                    {searchOptimizationMode && (
                      <button
                        onClick={() => {
                          setSearchOptimizationMode('');
                          localStorage.removeItem('searchOptimizationMode');
                        }}
                        className="p-1.5 rounded-md hover:bg-light-200 dark:hover:bg-dark-200 text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 transition-colors"
                        title="Reset optimization mode"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    Chat Model
                  </p>
                  <div className="flex justify-start items-center space-x-2">
                    <ModelSelector
                      selectedModel={{
                        provider: searchChatModelProvider,
                        model: searchChatModel,
                      }}
                      setSelectedModel={(model) => {
                        setSearchChatModelProvider(model.provider);
                        setSearchChatModel(model.model);
                        saveSearchSetting(
                          'searchChatModelProvider',
                          model.provider,
                        );
                        saveSearchSetting('searchChatModel', model.model);
                      }}
                      truncateModelName={false}
                    />
                    {(searchChatModelProvider || searchChatModel) && (
                      <button
                        onClick={() => {
                          setSearchChatModelProvider('');
                          setSearchChatModel('');
                          localStorage.removeItem('searchChatModelProvider');
                          localStorage.removeItem('searchChatModel');
                        }}
                        className="p-1.5 rounded-md hover:bg-light-200 dark:hover:bg-dark-200 text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 transition-colors"
                        title="Reset chat model"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection title="Model Settings">
              {config.chatModelProviders && (
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-col space-y-1">
                    <p className="text-black/70 dark:text-white/70 text-sm">
                      Chat Model Provider
                    </p>
                    <Select
                      value={selectedChatModelProvider ?? undefined}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedChatModelProvider(value);
                        saveConfig('chatModelProvider', value);
                        const firstModel =
                          config.chatModelProviders[value]?.[0]?.name;
                        if (firstModel) {
                          setSelectedChatModel(firstModel);
                          saveConfig('chatModel', firstModel);
                        }
                      }}
                      options={Object.keys(config.chatModelProviders).map(
                        (provider) => ({
                          value: provider,
                          label:
                            (PROVIDER_METADATA as any)[provider]?.displayName ||
                            provider.charAt(0).toUpperCase() +
                              provider.slice(1),
                        }),
                      )}
                    />
                  </div>

                  {selectedChatModelProvider &&
                    selectedChatModelProvider != 'custom_openai' && (
                      <div className="flex flex-col space-y-1">
                        <p className="text-black/70 dark:text-white/70 text-sm">
                          Chat Model
                        </p>
                        <Select
                          value={selectedChatModel ?? undefined}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSelectedChatModel(value);
                            saveConfig('chatModel', value);
                          }}
                          options={(() => {
                            const chatModelProvider =
                              config.chatModelProviders[
                                selectedChatModelProvider
                              ];
                            return chatModelProvider
                              ? chatModelProvider.length > 0
                                ? chatModelProvider.map((model) => ({
                                    value: model.name,
                                    label: model.displayName,
                                  }))
                                : [
                                    {
                                      value: '',
                                      label: 'No models available',
                                      disabled: true,
                                    },
                                  ]
                              : [
                                  {
                                    value: '',
                                    label:
                                      'Invalid provider, please check backend logs',
                                    disabled: true,
                                  },
                                ];
                          })()}
                        />
                        {selectedChatModelProvider === 'ollama' && (
                          <div className="flex flex-col space-y-1">
                            <p className="text-black/70 dark:text-white/70 text-sm">
                              Chat Context Window Size
                            </p>
                            <Select
                              value={
                                isCustomContextWindow
                                  ? 'custom'
                                  : contextWindowSize.toString()
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === 'custom') {
                                  setIsCustomContextWindow(true);
                                } else {
                                  setIsCustomContextWindow(false);
                                  const numValue = parseInt(value);
                                  setContextWindowSize(numValue);
                                  setConfig((prev) => ({
                                    ...prev!,
                                    ollamaContextWindow: numValue,
                                  }));
                                  saveConfig('ollamaContextWindow', numValue);
                                }
                              }}
                              options={[
                                ...predefinedContextSizes.map((size) => ({
                                  value: size.toString(),
                                  label: `${size.toLocaleString()} tokens`,
                                })),
                                { value: 'custom', label: 'Custom...' },
                              ]}
                            />
                            {isCustomContextWindow && (
                              <div className="mt-2">
                                <InputComponent
                                  type="number"
                                  min={512}
                                  value={contextWindowSize}
                                  placeholder="Custom context window size (minimum 512)"
                                  isSaving={savingStates['ollamaContextWindow']}
                                  onChange={(e) => {
                                    // Allow any value to be typed
                                    const value =
                                      parseInt(e.target.value) ||
                                      contextWindowSize;
                                    setContextWindowSize(value);
                                  }}
                                  onSave={(value) => {
                                    // Validate only when saving
                                    const numValue = Math.max(
                                      512,
                                      parseInt(value) || 2048,
                                    );
                                    setContextWindowSize(numValue);
                                    setConfig((prev) => ({
                                      ...prev!,
                                      ollamaContextWindow: numValue,
                                    }));
                                    saveConfig('ollamaContextWindow', numValue);
                                  }}
                                />
                              </div>
                            )}
                            <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                              {isCustomContextWindow
                                ? 'Adjust the context window size for Ollama models (minimum 512 tokens)'
                                : 'Adjust the context window size for Ollama models'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}

              {selectedChatModelProvider &&
                selectedChatModelProvider === 'custom_openai' && (
                  <div className="flex flex-col space-y-4">
                    <div className="flex flex-col space-y-1">
                      <p className="text-black/70 dark:text-white/70 text-sm">
                        Model Name
                      </p>
                      <InputComponent
                        type="text"
                        placeholder="Model name"
                        value={config.customOpenaiModelName}
                        isSaving={savingStates['customOpenaiModelName']}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setConfig((prev) => ({
                            ...prev!,
                            customOpenaiModelName: e.target.value,
                          }));
                        }}
                        onSave={(value) =>
                          saveConfig('customOpenaiModelName', value)
                        }
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <p className="text-black/70 dark:text-white/70 text-sm">
                        Custom OpenAI API Key
                      </p>
                      <InputComponent
                        type="password"
                        placeholder="Custom OpenAI API Key"
                        value={config.customOpenaiApiKey}
                        isSaving={savingStates['customOpenaiApiKey']}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setConfig((prev) => ({
                            ...prev!,
                            customOpenaiApiKey: e.target.value,
                          }));
                        }}
                        onSave={(value) =>
                          saveConfig('customOpenaiApiKey', value)
                        }
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <p className="text-black/70 dark:text-white/70 text-sm">
                        Custom OpenAI Base URL
                      </p>
                      <InputComponent
                        type="text"
                        placeholder="Custom OpenAI Base URL"
                        value={config.customOpenaiApiUrl}
                        isSaving={savingStates['customOpenaiApiUrl']}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setConfig((prev) => ({
                            ...prev!,
                            customOpenaiApiUrl: e.target.value,
                          }));
                        }}
                        onSave={(value) =>
                          saveConfig('customOpenaiApiUrl', value)
                        }
                      />
                    </div>
                  </div>
                )}

              {config.embeddingModelProviders && (
                <div className="flex flex-col space-y-4 mt-4 pt-4 border-t border-light-200 dark:border-dark-200">
                  <div className="flex flex-col space-y-1">
                    <p className="text-black/70 dark:text-white/70 text-sm">
                      Embedding Model Provider
                    </p>
                    <Select
                      value={selectedEmbeddingModelProvider ?? undefined}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedEmbeddingModelProvider(value);
                        saveConfig('embeddingModelProvider', value);
                        const firstModel =
                          config.embeddingModelProviders[value]?.[0]?.name;
                        if (firstModel) {
                          setSelectedEmbeddingModel(firstModel);
                          saveConfig('embeddingModel', firstModel);
                        }
                      }}
                      options={Object.keys(config.embeddingModelProviders).map(
                        (provider) => ({
                          value: provider,
                          label:
                            (PROVIDER_METADATA as any)[provider]?.displayName ||
                            provider.charAt(0).toUpperCase() +
                              provider.slice(1),
                        }),
                      )}
                    />
                  </div>

                  {selectedEmbeddingModelProvider && (
                    <div className="flex flex-col space-y-1">
                      <p className="text-black/70 dark:text-white/70 text-sm">
                        Embedding Model
                      </p>
                      <Select
                        value={selectedEmbeddingModel ?? undefined}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedEmbeddingModel(value);
                          saveConfig('embeddingModel', value);
                        }}
                        options={(() => {
                          const embeddingModelProvider =
                            config.embeddingModelProviders[
                              selectedEmbeddingModelProvider
                            ];
                          return embeddingModelProvider
                            ? embeddingModelProvider.length > 0
                              ? embeddingModelProvider.map((model) => ({
                                  value: model.name,
                                  label: model.displayName,
                                }))
                              : [
                                  {
                                    value: '',
                                    label: 'No models available',
                                    disabled: true,
                                  },
                                ]
                            : [
                                {
                                  value: '',
                                  label:
                                    'Invalid provider, please check backend logs',
                                  disabled: true,
                                },
                              ];
                        })()}
                      />
                    </div>
                  )}
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              title="Model Visibility"
              tooltip="Hide models from the API to prevent them from appearing in model lists.\nHidden models will not be available for selection in the interface.\nThis allows server admins to disable models that may incur large costs or won't work with the application."
            >
              <div className="flex flex-col space-y-3">
                {/* Unified Models List */}
                {(() => {
                  // Combine all models from both chat and embedding providers
                  const allProviders: Record<string, Record<string, any>> = {};

                  // Add chat models
                  Object.entries(allModels.chat).forEach(
                    ([provider, models]) => {
                      if (!allProviders[provider]) {
                        allProviders[provider] = {};
                      }
                      Object.entries(models).forEach(([modelKey, model]) => {
                        allProviders[provider][modelKey] = model;
                      });
                    },
                  );

                  // Add embedding models
                  Object.entries(allModels.embedding).forEach(
                    ([provider, models]) => {
                      if (!allProviders[provider]) {
                        allProviders[provider] = {};
                      }
                      Object.entries(models).forEach(([modelKey, model]) => {
                        allProviders[provider][modelKey] = model;
                      });
                    },
                  );

                  return Object.keys(allProviders).length > 0 ? (
                    Object.entries(allProviders).map(([provider, models]) => {
                      const providerId = `provider-${provider}`;
                      const isExpanded = expandedProviders.has(providerId);
                      const modelEntries = Object.entries(models);
                      const hiddenCount = modelEntries.filter(([modelKey]) =>
                        hiddenModels.includes(modelKey),
                      ).length;
                      const totalCount = modelEntries.length;

                      return (
                        <div
                          key={providerId}
                          className="border border-light-200 dark:border-dark-200 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() => toggleProviderExpansion(providerId)}
                            className="w-full p-3 bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200 transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              {isExpanded ? (
                                <ChevronDown
                                  size={16}
                                  className="text-black/70 dark:text-white/70"
                                />
                              ) : (
                                <ChevronRight
                                  size={16}
                                  className="text-black/70 dark:text-white/70"
                                />
                              )}
                              <h4 className="text-sm font-medium text-black/80 dark:text-white/80">
                                {(PROVIDER_METADATA as any)[provider]
                                  ?.displayName ||
                                  provider.charAt(0).toUpperCase() +
                                    provider.slice(1)}
                              </h4>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-black/60 dark:text-white/60">
                              <span>{totalCount - hiddenCount} visible</span>
                              {hiddenCount > 0 && (
                                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                                  {hiddenCount} hidden
                                </span>
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-3 bg-light-100 dark:bg-dark-100 border-t border-light-200 dark:border-dark-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {modelEntries.map(([modelKey, model]) => (
                                  <div
                                    key={`${provider}-${modelKey}`}
                                    className="flex items-center justify-between p-2 bg-white dark:bg-dark-secondary rounded-md"
                                  >
                                    <span className="text-sm text-black/90 dark:text-white/90">
                                      {model.displayName || modelKey}
                                    </span>
                                    <Switch
                                      checked={!hiddenModels.includes(modelKey)}
                                      onChange={(checked) => {
                                        handleModelVisibilityToggle(
                                          modelKey,
                                          checked,
                                        );
                                      }}
                                      className={cn(
                                        !hiddenModels.includes(modelKey)
                                          ? 'bg-[#24A0ED]'
                                          : 'bg-light-200 dark:bg-dark-200',
                                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          !hiddenModels.includes(modelKey)
                                            ? 'translate-x-5'
                                            : 'translate-x-1',
                                          'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                                        )}
                                      />
                                    </Switch>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-black/60 dark:text-white/60 italic">
                      No models available
                    </p>
                  );
                })()}
              </div>
            </SettingsSection>

            <SettingsSection
              title="API Keys"
              tooltip="API Key values can be viewed in the config.toml file"
            >
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    OpenAI API Key
                  </p>
                  <InputComponent
                    type="password"
                    placeholder="OpenAI API Key"
                    value={config.openaiApiKey}
                    isSaving={savingStates['openaiApiKey']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        openaiApiKey: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('openaiApiKey', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    Ollama API URL
                  </p>
                  <InputComponent
                    type="text"
                    placeholder="Ollama API URL"
                    value={config.ollamaApiUrl}
                    isSaving={savingStates['ollamaApiUrl']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        ollamaApiUrl: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('ollamaApiUrl', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    GROQ API Key
                  </p>
                  <InputComponent
                    type="password"
                    placeholder="GROQ API Key"
                    value={config.groqApiKey}
                    isSaving={savingStates['groqApiKey']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        groqApiKey: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('groqApiKey', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    OpenRouter API Key
                  </p>
                  <InputComponent
                    type="password"
                    placeholder="OpenRouter API Key"
                    value={config.openrouterApiKey}
                    isSaving={savingStates['openrouterApiKey']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        openrouterApiKey: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('openrouterApiKey', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    Anthropic API Key
                  </p>
                  <InputComponent
                    type="password"
                    placeholder="Anthropic API key"
                    value={config.anthropicApiKey}
                    isSaving={savingStates['anthropicApiKey']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        anthropicApiKey: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('anthropicApiKey', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    Gemini API Key
                  </p>
                  <InputComponent
                    type="password"
                    placeholder="Gemini API key"
                    value={config.geminiApiKey}
                    isSaving={savingStates['geminiApiKey']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        geminiApiKey: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('geminiApiKey', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    Deepseek API Key
                  </p>
                  <InputComponent
                    type="password"
                    placeholder="Deepseek API Key"
                    value={config.deepseekApiKey}
                    isSaving={savingStates['deepseekApiKey']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        deepseekApiKey: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('deepseekApiKey', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    AI/ML API Key
                  </p>
                  <InputComponent
                    type="text"
                    placeholder="AI/ML API Key"
                    value={config.aimlApiKey}
                    isSaving={savingStates['aimlApiKey']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        aimlApiKey: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('aimlApiKey', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    AI/ML API Key
                  </p>
                  <InputComponent
                    type="text"
                    placeholder="AI/ML API Key"
                    value={config.aimlApiKey}
                    isSaving={savingStates['aimlApiKey']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        aimlApiKey: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('aimlApiKey', value)}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <p className="text-black/70 dark:text-white/70 text-sm">
                    LM Studio API URL
                  </p>
                  <InputComponent
                    type="text"
                    placeholder="LM Studio API URL"
                    value={config.lmStudioApiUrl}
                    isSaving={savingStates['lmStudioApiUrl']}
                    onChange={(e) => {
                      setConfig((prev) => ({
                        ...prev!,
                        lmStudioApiUrl: e.target.value,
                      }));
                    }}
                    onSave={(value) => saveConfig('lmStudioApiUrl', value)}
                  />
                </div>
              </div>
            </SettingsSection>
          </div>
        )
      )}
    </div>
  );
}
