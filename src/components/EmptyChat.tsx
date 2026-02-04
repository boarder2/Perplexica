import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { File } from './ChatWindow';
import Link from 'next/link';
import MessageInput from './MessageInput';
import WeatherWidget from './WeatherWidget';
import NewsArticleWidget from './NewsArticleWidget';

const EmptyChat = ({
  sendMessage,
  focusMode,
  setFocusMode,
  systemPromptIds,
  setSystemPromptIds,
  fileIds,
  setFileIds,
  files,
  setFiles,
  sendLocation,
  setSendLocation,
  sendPersonalization,
  setSendPersonalization,
  personalizationLocation,
  personalizationAbout,
  refreshPersonalization,
}: {
  sendMessage: (message: string) => void;
  focusMode: string;
  setFocusMode: (mode: string) => void;
  systemPromptIds: string[];
  setSystemPromptIds: (ids: string[]) => void;
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  sendLocation: boolean;
  setSendLocation: (value: boolean) => void;
  sendPersonalization: boolean;
  setSendPersonalization: (value: boolean) => void;
  personalizationLocation?: string;
  personalizationAbout?: string;
  refreshPersonalization?: () => void;
}) => {
  const [showWeatherWidget, setShowWeatherWidget] = useState(true);
  const [showNewsWidget, setShowNewsWidget] = useState(true);

  useEffect(() => {
    setShowWeatherWidget(localStorage.getItem('showWeatherWidget') !== 'false');
    setShowNewsWidget(localStorage.getItem('showNewsWidget') !== 'false');
  }, []);
  return (
    <div className="relative">
      <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5">
        <Link href="/settings">
          <Settings className="cursor-pointer lg:hidden" />
        </Link>
      </div>
      <div className="flex flex-col items-center justify-center min-h-screen max-w-screen-sm mx-auto p-2 space-y-4">
        <div className="flex flex-col items-center justify-center w-full space-y-8">
          {/* <h2 className="text-3xl font-medium -mt-8">Research begins here.</h2> */}
          <MessageInput
            firstMessage={true}
            loading={false}
            sendMessage={sendMessage}
            focusMode={focusMode}
            setFocusMode={setFocusMode}
            fileIds={fileIds}
            setFileIds={setFileIds}
            files={files}
            systemPromptIds={systemPromptIds}
            setSystemPromptIds={setSystemPromptIds}
            setFiles={setFiles}
            sendLocation={sendLocation}
            setSendLocation={setSendLocation}
            sendPersonalization={sendPersonalization}
            setSendPersonalization={setSendPersonalization}
            personalizationLocation={personalizationLocation}
            personalizationAbout={personalizationAbout}
            refreshPersonalization={refreshPersonalization}
          />
        </div>
        <div className="flex flex-col w-full gap-4 mt-2 sm:flex-row sm:justify-center">
          {showWeatherWidget && (
            <div className="flex-1 w-full">
              <WeatherWidget />
            </div>
          )}
          {showNewsWidget && (
            <div className="flex-1 w-full">
              <NewsArticleWidget />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmptyChat;
