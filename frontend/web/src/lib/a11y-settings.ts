/** Browser storage keys of the header accessibility tools. */
export const TEXT_SIZE_KEY = 'sarmata.textSize';
export const CONTRAST_KEY = 'sarmata.contrast';

/**
 * Runs in the document head before the first paint, so a saved larger text or high contrast
 * applies on every page (also the sign-in and error pages) without a visible jump.
 */
export const applySavedA11ySettings = `try{var d=document.documentElement;if(localStorage.getItem(${JSON.stringify(TEXT_SIZE_KEY)})==='large')d.dataset.textSize='large';if(localStorage.getItem(${JSON.stringify(CONTRAST_KEY)})==='high')d.dataset.contrast='high'}catch(e){}`;
