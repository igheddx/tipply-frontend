/**
 * Demo mode, production only: while the site takes fake money, tips are marked demo and the performer's screens show
 * real tips by default. This holds whether demo mode is on and whether the performer chose to look at demo data, so
 * every request for tips can ask for the right set. The backend ignores the flag on test and dev.
 */
let demoModeOn = false
let showDemo = false

export const setDemoModeOn = (on: boolean) => {
  demoModeOn = on
  if (!on) showDemo = false
}

export const setShowDemoData = (show: boolean) => {
  showDemo = demoModeOn && show
}

/** True only while demo mode is on AND the performer chose to see demo data. */
export const wantsDemoData = () => demoModeOn && showDemo

/** Query string piece to add to a tips request, or '' when real data is wanted. `joiner` is '?' or '&'. */
export const demoQuery = (joiner: '?' | '&') => (wantsDemoData() ? `${joiner}demo=true` : '')
