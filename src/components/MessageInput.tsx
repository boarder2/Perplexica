import { ArrowRight, ArrowUp, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { File, ImageAttachment } from './ChatWindow';
import Attach from './MessageInputActions/Attach';
import Focus from './MessageInputActions/Focus';
import ModelConfigurator from './MessageInputActions/ModelConfigurator';
import SystemPromptSelector from './MessageInputActions/SystemPromptSelector'; // Import new component
import PersonalizationPicker from './PersonalizationPicker';

const MessageInput = ({
  sendMessage,
  loading,
  fileIds,
  setFileIds,
  files,
  setFiles,
  focusMode,
  setFocusMode,
  firstMessage,
  onCancel,
  systemPromptIds,
  setSystemPromptIds,
  sendLocation,
  setSendLocation,
  sendPersonalization,
  setSendPersonalization,
  personalizationLocation,
  personalizationAbout,
  refreshPersonalization,
  pendingImages,
  setPendingImages,
}: {
  sendMessage: (
    message: string,
    options?: {
      messageId?: string; // For rewrites/edits
      selectedSystemPromptIds?: string[];
    },
  ) => void;
  loading: boolean;
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  focusMode: string;
  setFocusMode: (mode: string) => void;
  firstMessage: boolean;
  onCancel?: () => void;
  systemPromptIds: string[];
  setSystemPromptIds: (ids: string[]) => void;
  sendLocation: boolean;
  setSendLocation: (value: boolean) => void;
  sendPersonalization: boolean;
  setSendPersonalization: (value: boolean) => void;
  personalizationLocation?: string;
  personalizationAbout?: string;
  refreshPersonalization?: () => void;
  pendingImages: ImageAttachment[];
  setPendingImages: (images: ImageAttachment[]) => void;
}) => {
  const [message, setMessage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const uploadImageFiles = async (imageFiles: globalThis.File[]) => {
    if (imageFiles.length === 0) return;
    setIsUploadingImage(true);
    const formData = new FormData();
    imageFiles.forEach((f) => formData.append('images', f));
    try {
      const res = await fetch('/api/uploads/images', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.images) {
        setPendingImages([...pendingImages, ...data.images]);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    setIsUploadingImage(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: globalThis.File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      uploadImageFiles(imageFiles);
    }
  };

  useEffect(() => {
    const storedPromptIds = localStorage.getItem('selectedSystemPromptIds');
    if (storedPromptIds) {
      try {
        const parsedIds = JSON.parse(storedPromptIds);
        if (Array.isArray(parsedIds)) {
          setSystemPromptIds(parsedIds);
        }
      } catch (e) {
        console.error(
          'Failed to parse selectedSystemPromptIds from localStorage',
          e,
        );
        localStorage.removeItem('selectedSystemPromptIds'); // Clear corrupted data
      }
    }
  }, [setSystemPromptIds]);

  useEffect(() => {
    if (systemPromptIds.length > 0) {
      localStorage.setItem(
        'selectedSystemPromptIds',
        JSON.stringify(systemPromptIds),
      );
    } else {
      // Remove from localStorage if no prompts are selected to keep it clean
      localStorage.removeItem('selectedSystemPromptIds');
    }
  }, [systemPromptIds]);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable');
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Function to handle message submission
  const handleSubmitMessage = () => {
    // Only submit if we have a non-empty message or images, and not currently loading
    if (loading || (message.trim().length === 0 && pendingImages.length === 0))
      return;

    sendMessage(message);
    setMessage('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmitMessage();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmitMessage();
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col bg-surface px-3 pt-4 pb-2 rounded-lg w-full border border-surface-2">
        {(pendingImages.length > 0 || isUploadingImage) && (
          <div className="flex flex-row gap-2 mb-2 overflow-x-auto pb-1">
            {pendingImages.map((img) => (
              <div
                key={img.imageId}
                className="relative flex-shrink-0 group/thumb"
              >
                <img
                  src={`/api/uploads/images/${img.imageId}`}
                  alt={img.fileName}
                  className="h-20 w-20 object-cover rounded-lg border border-surface-2"
                />
                <button
                  type="button"
                  className="absolute -top-1.5 -right-1.5 bg-surface border border-surface-2 rounded-full p-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  onClick={() =>
                    setPendingImages(
                      pendingImages.filter((i) => i.imageId !== img.imageId),
                    )
                  }
                  aria-label={`Remove ${img.fileName}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {isUploadingImage && (
              <div className="h-20 w-20 flex-shrink-0 flex items-center justify-center rounded-lg border border-surface-2 bg-surface-2/50">
                <div className="w-5 h-5 border-2 border-fg/30 border-t-fg animate-spin rounded-full" />
              </div>
            )}
          </div>
        )}
        <div className="flex flex-row space-x-2 mb-2">
          <TextareaAutosize
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onPaste={handlePaste}
            minRows={1}
            className="px-3 py-2 overflow-hidden flex rounded-lg bg-transparent text-sm resize-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
            placeholder={
              firstMessage
                ? 'What would you like to learn today?'
                : 'Ask a follow-up'
            }
            autoFocus={true}
          />
        </div>
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center space-x-2">
            <Focus focusMode={focusMode} setFocusMode={setFocusMode} />
            <Attach
              fileIds={fileIds}
              setFileIds={setFileIds}
              files={files}
              setFiles={setFiles}
              pendingImages={pendingImages}
              setPendingImages={setPendingImages}
            />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <ModelConfigurator showModelName={false} />
            <SystemPromptSelector
              selectedPromptIds={systemPromptIds}
              onSelectedPromptIdsChange={setSystemPromptIds}
            />
            <PersonalizationPicker
              hasLocation={personalizationLocation?.trim() !== ''}
              hasProfile={personalizationAbout?.trim() !== ''}
              sendLocation={sendLocation}
              setSendLocation={setSendLocation}
              sendPersonalization={sendPersonalization}
              setSendPersonalization={setSendPersonalization}
              locationPreview={personalizationLocation}
              profilePreview={personalizationAbout}
              onRefresh={refreshPersonalization}
            />
            {loading ? (
              <button
                type="button"
                className="bg-red-700 text-white hover:bg-red-800 transition duration-100 rounded-full p-2 relative group"
                onClick={onCancel}
                aria-label="Cancel"
              >
                {loading && (
                  <div className="absolute inset-0 rounded-full border-2 border-fg/30 border-t-fg animate-spin" />
                )}
                <span className="relative flex items-center justify-center w-[17px] h-[17px]">
                  <Square size={17} className="text-white" />
                </span>
              </button>
            ) : (
              <button
                disabled={
                  message.trim().length === 0 && pendingImages.length === 0
                }
                className="bg-accent text-white disabled:text-white/50 disabled:bg-accent/20 hover:bg-accent-700 transition duration-100 rounded-full p-2"
                type="submit"
              >
                {firstMessage ? (
                  <ArrowRight size={17} />
                ) : (
                  <ArrowUp size={17} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

export default MessageInput;
