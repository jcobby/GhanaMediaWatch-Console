import { MapPin, Clock } from 'lucide-react';
import { formatExactCapture, type Incident } from '@dawuro/core';

/**
 * Capture time and place, stamped onto the footage.
 *
 * This is provenance, not decoration. An organisation deciding whether to act
 * on a report needs to know when and where it was taken, and a caption sitting
 * beside the video is separated from it the moment the file is downloaded,
 * forwarded or screenshotted. Stamping it on the frame keeps the claim attached
 * to the evidence.
 *
 * The reporter's privacy choices are already applied by the time an Incident
 * reaches here: `capturedAtIso` is null when they hid the date, and
 * `location.label` is null when they hid the place. Redaction happens before
 * the data is sent, not in the renderer — so this stamp cannot leak something
 * a reporter withheld even if it tried.
 *
 * Hidden fields are simply absent rather than replaced with a placeholder,
 * which would advertise that something was withheld.
 */
export function CaptureStamp({ incident }: { incident: Incident }) {
  const when = formatExactCapture(incident.capturedAtIso, incident.capturedAtPrecision);
  const where = incident.location.label;

  if (!when && !where) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none">
      {/* A short gradient rather than a flat bar: the stamp must stay legible
          over any footage without hiding the bottom of the frame. */}
      <div className="bg-gradient-to-t from-black/75 via-black/45 to-transparent px-3 pb-2.5 pt-8">
        <div className="flex flex-col gap-0.5 text-white">
          {where ? (
            <span className="flex items-center gap-1.5 text-xs font-medium drop-shadow">
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={2.5} />
              {where}
            </span>
          ) : null}
          {when ? (
            <span className="flex items-center gap-1.5 text-xs tabular drop-shadow">
              <Clock className="h-3 w-3 shrink-0" strokeWidth={2.5} />
              {when}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
