/** Must match server/src/slots.ts (visit window). */
export const BOOKING_SLOT_TIMES: string[] = (() => {
  const SLOT_START_MIN = 7 * 60;
  const SLOT_END_MIN = 19 * 60;
  const STEP = 30;
  const out: string[] = [];
  for (let m = SLOT_START_MIN; m < SLOT_END_MIN; m += STEP) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return out;
})();
