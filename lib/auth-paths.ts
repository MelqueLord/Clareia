import type { Space } from './model';
export function personalSignInPath(space:Space){return '/signin-with-chatgpt?return_to='+encodeURIComponent('/api/auth/personal?space='+space);}
