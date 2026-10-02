import { useId, useMemo } from 'react';
import petMarkup from '../assets/clawdpet.svg?raw';

export type PetMood = 'idle' | 'happy' | 'wave' | 'sleepy';

export default function PetGraphic({
  mood = 'idle',
  className = '',
}: {
  mood?: PetMood;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  // Each pet needs its own gradient IDs when several SVGs share a page.
  const markup = useMemo(
    () => petMarkup.replace(/clawd-/g, `clawd-${id}-`),
    [id],
  );

  return (
    <div
      className={`pet-graphic mood-${mood} ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}