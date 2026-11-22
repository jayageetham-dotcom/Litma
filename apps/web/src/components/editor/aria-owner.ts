/**
 * The Manglish list and the spelling card both point the editor at their list (aria-controls,
 * aria-activedescendant). Each sets its own ids with its own prefix and only ever removes a
 * value that still carries that prefix, so one never wipes out the other.
 */
export function ownAttr(el: HTMLElement, name: string, value: string | null, prefix: string) {
  if (value) el.setAttribute(name, value);
  else if (el.getAttribute(name)?.startsWith(prefix)) el.removeAttribute(name);
}

/** A stable DOM id from React's useId (which contains colons). */
export const domId = (prefix: string, reactId: string) => `${prefix}${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
