// Visit counting: events go to the counter on our server (robinsout/counter), with sendBeacon.
// The address is set at build time: VITE_COUNTER_URL; off in development and tests, and when the
// visitor turns it off ("do not count my visits", a switch of its own in localStorage) or sends GPC.
import { DEFAULT_COUNTER_URL } from '../../shared/counter-api.ts';
import { createCounter, isCounterOff, setCounterOff, type Props } from './counter.ts';
const fromEnv = import.meta.env.VITE_COUNTER_URL as string | undefined;
export const COUNTER_URL: string = fromEnv ?? (import.meta.env.PROD ? DEFAULT_COUNTER_URL : '');

const counter = createCounter({ endpoint: COUNTER_URL, project: 'quadern' });

export const visitsApi = {
  count: (event: string, props: Props): void => counter.count(event, props),
  isOff: isCounterOff,
  setOff: setCounterOff,
};
