import type { Request } from 'express';

/**
 * Build an absolute URL for this request (honors reverse proxies: ALB, CloudFront).
 */
export function absoluteUrlFromReq(req: Request, pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost').split(',')[0].trim();
  let proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  proto = proto.replace(/:$/, '');
  return `${proto}://${host}${path}`;
}
