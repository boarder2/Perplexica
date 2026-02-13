import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { File, LoaderCircle, Paperclip, Plus, Trash } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { File as FileType } from '../ChatWindow';

const Attach = ({
  fileIds,
  setFileIds,
  files,
  setFiles,
}: {
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: FileType[];
  setFiles: (files: FileType[]) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    const data = new FormData();

    for (let i = 0; i < e.target.files!.length; i++) {
      data.append('files', e.target.files![i]);
    }

    const embeddingModelProvider = localStorage.getItem(
      'embeddingModelProvider',
    );
    const embeddingModel = localStorage.getItem('embeddingModel');
    const chatModelProvider = localStorage.getItem('chatModelProvider');
    const chatModel = localStorage.getItem('chatModel');
    const ollamaContextWindow =
      localStorage.getItem('ollamaContextWindow') || '2048';

    data.append('embedding_model_provider', embeddingModelProvider!);
    data.append('embedding_model', embeddingModel!);
    data.append('chat_model_provider', chatModelProvider!);
    data.append('chat_model', chatModel!);
    if (chatModelProvider === 'ollama') {
      data.append('ollama_context_window', ollamaContextWindow);
    }

    const res = await fetch(`/api/uploads`, {
      method: 'POST',
      body: data,
    });

    const resData = await res.json();

    setFiles([...files, ...resData.files]);
    setFileIds([...fileIds, ...resData.files.map((file: Record<string, string>) => file.fileId)]);
    setLoading(false);
  };

  return loading ? (
    <div className="flex flex-row items-center justify-between space-x-1">
      <LoaderCircle size={18} className="text-sky-400 animate-spin" />
      <p className="text-sky-400 inline whitespace-nowrap text-xs font-medium">
        Uploading..
      </p>
    </div>
  ) : files.length > 0 ? (
    <div className="relative group">
      <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
        <PopoverButton
          type="button"
          className={cn(
            'flex flex-row items-center justify-between space-x-1 p-2 rounded-xl transition duration-200 text-fg/50 hover:bg-surface-2 hover:text-fg',
            files.length > 0 ? '-ml-2 lg:-ml-3' : '',
          )}
        >
          {files.length > 1 && (
            <>
              <File size={19} className="text-accent" />
              <p className="inline whitespace-nowrap text-xs font-medium text-accent">
                {files.length} files
              </p>
            </>
          )}

          {files.length === 1 && (
            <>
              <File size={18} className="text-accent" />
              <p className="text-xs font-medium text-accent">
                {files[0].fileName.length > 10
                  ? files[0].fileName.replace(/\.\w+$/, '').substring(0, 3) +
                    '...' +
                    files[0].fileExtension
                  : files[0].fileName}
              </p>
            </>
          )}
        </PopoverButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-150"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <PopoverPanel className="absolute z-10 w-64 md:w-[350px] right-0">
            <div className="bg-surface border rounded-md border-surface-2 w-full max-h-[200px] md:max-h-none overflow-y-auto flex flex-col">
              <div className="flex flex-row items-center justify-between px-3 py-2">
                <h4 className="text-fg font-medium text-sm">Attached files</h4>
                <div className="flex flex-row items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-row items-center space-x-1 transition duration-200 text-fg/70 hover:text-fg"
                  >
                    <input
                      type="file"
                      onChange={handleChange}
                      ref={fileInputRef}
                      accept=".pdf,.docx,.txt"
                      multiple
                      hidden
                    />
                    <Plus size={18} />
                    <p className="text-xs">Add</p>
                  </button>
                  <button
                    onClick={() => {
                      setFiles([]);
                      setFileIds([]);
                    }}
                    className="flex flex-row items-center space-x-1 transition duration-200 text-fg/70 hover:text-fg"
                  >
                    <Trash size={14} />
                    <p className="text-xs">Clear</p>
                  </button>
                </div>
              </div>
              <div className="h-[0.5px] mx-2 bg-surface-2" />
              <div className="flex flex-col items-center">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex flex-row items-center justify-start w-full space-x-3 p-3"
                  >
                    <div className="bg-surface-2 flex items-center justify-center w-10 h-10 rounded-md">
                      <File size={16} className="text-fg/70" />
                    </div>
                    <p className="text-fg/70 text-sm">
                      {file.fileName.length > 25
                        ? file.fileName.replace(/\.\w+$/, '').substring(0, 25) +
                          '...' +
                          file.fileExtension
                        : file.fileName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  ) : (
    <div className="relative group">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-row items-center space-x-1 rounded-xl transition duration-200 p-2 text-fg/50 hover:bg-surface-2 hover:text-fg"
      >
        <input
          type="file"
          onChange={handleChange}
          ref={fileInputRef}
          accept=".pdf,.docx,.txt"
          multiple
          hidden
        />
        <Paperclip size="18" />
      </button>
    </div>
  );
};

export default Attach;
