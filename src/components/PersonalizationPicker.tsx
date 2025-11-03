'use client';

import { Fragment, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  Switch,
} from '@headlessui/react';
import { Settings as SettingsIcon, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

type PersonalizationPickerProps = {
  hasLocation: boolean;
  hasProfile: boolean;
  sendLocation: boolean;
  setSendLocation: (value: boolean) => void;
  sendPersonalization: boolean;
  setSendPersonalization: (value: boolean) => void;
  locationPreview?: string;
  profilePreview?: string;
  onRefresh?: () => void;
};

type PopoverContentProps = {
  open: boolean;
  hasLocation: boolean;
  hasProfile: boolean;
  sendLocation: boolean;
  setSendLocation: (value: boolean) => void;
  sendPersonalization: boolean;
  setSendPersonalization: (value: boolean) => void;
  locationSummary: string;
  profileSummary: string;
  onRefresh?: () => void;
};

const truncate = (value?: string, max = 80) => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
};

const PopoverContent = ({
  open,
  hasLocation,
  hasProfile,
  sendLocation,
  setSendLocation,
  sendPersonalization,
  setSendPersonalization,
  locationSummary,
  profileSummary,
  onRefresh,
}: PopoverContentProps) => {
  const previousOpen = useRef(open);

  useEffect(() => {
    if (open && !previousOpen.current) {
      onRefresh?.();
    }
    previousOpen.current = open;
  }, [open, onRefresh]);

  return (
    <>
      <PopoverButton
        className={cn(
          'flex items-center gap-1 rounded-lg text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 p-1',
          sendLocation || sendPersonalization
            ? 'text-accent hover:text-accent'
            : 'text-fg/60 hover:text-fg/30',
        )}
        title="Personalization options"
      >
        <UserCog size={18} />
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute right-0 z-30 w-80 transform bottom-full mb-2">
          <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-surface-2 bg-surface">
            <div className="px-4 py-3 border-b border-surface-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-fg/90">
                  Personalization
                </h3>
                <p className="text-xs text-fg/60 mt-0.5">
                  Choose what to send with this message.
                </p>
              </div>
              <Link
                href="/settings#personalization"
                className="text-xs inline-flex items-center gap-1 text-accent hover:underline"
                title="Open personalization settings"
              >
                <SettingsIcon size={14} />
              </Link>
            </div>

            <div className="px-4 py-3 space-y-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Send location</span>
                  <Switch
                    checked={sendLocation && hasLocation}
                    onChange={(value) => {
                      if (!hasLocation) return;
                      setSendLocation(value);
                    }}
                    disabled={!hasLocation}
                    className={cn(
                      sendLocation && hasLocation
                        ? 'bg-accent'
                        : 'bg-surface-2',
                      !hasLocation && 'opacity-40 cursor-not-allowed',
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                    )}
                  >
                    <span
                      className={cn(
                        sendLocation && hasLocation
                          ? 'translate-x-5'
                          : 'translate-x-1',
                        'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                      )}
                    />
                  </Switch>
                </div>
                <p className="text-xs text-fg/60">{locationSummary}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Send personalization</span>
                  <Switch
                    checked={sendPersonalization && hasProfile}
                    onChange={(value) => {
                      if (!hasProfile) return;
                      setSendPersonalization(value);
                    }}
                    disabled={!hasProfile}
                    className={cn(
                      sendPersonalization && hasProfile
                        ? 'bg-accent'
                        : 'bg-surface-2',
                      !hasProfile && 'opacity-40 cursor-not-allowed',
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                    )}
                  >
                    <span
                      className={cn(
                        sendPersonalization && hasProfile
                          ? 'translate-x-5'
                          : 'translate-x-1',
                        'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                      )}
                    />
                  </Switch>
                </div>
                <p className="text-xs text-fg/60">{profileSummary}</p>
              </div>
            </div>
          </div>
        </PopoverPanel>
      </Transition>
    </>
  );
};

const PersonalizationPicker = ({
  hasLocation,
  hasProfile,
  sendLocation,
  setSendLocation,
  sendPersonalization,
  setSendPersonalization,
  locationPreview,
  profilePreview,
  onRefresh,
}: PersonalizationPickerProps) => {
  const locationSummary = useMemo(() => {
    if (!hasLocation) return 'No location saved';
    return truncate(locationPreview);
  }, [hasLocation, locationPreview]);

  const profileSummary = useMemo(() => {
    if (!hasProfile) return 'No personalization saved';
    return truncate(profilePreview);
  }, [hasProfile, profilePreview]);

  return (
    <Popover className="relative">
      {({ open }) => (
        <PopoverContent
          open={open}
          hasLocation={hasLocation}
          hasProfile={hasProfile}
          sendLocation={sendLocation}
          setSendLocation={setSendLocation}
          sendPersonalization={sendPersonalization}
          setSendPersonalization={setSendPersonalization}
          locationSummary={locationSummary}
          profileSummary={profileSummary}
          onRefresh={onRefresh}
        />
      )}
    </Popover>
  );
};

export default PersonalizationPicker;
