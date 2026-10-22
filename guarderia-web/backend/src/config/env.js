export function securityConfig(env = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('REEMPLAZAR')) throw new Error('JWT_SECRET requiere un secreto aleatorio de al menos 32 caracteres');
  const secure = env.COOKIE_SECURE === 'true';
  if (env.NODE_ENV === 'production' && !secure) throw new Error('Producción requiere cookies Secure y HTTPS');
  return {secret, secure, origin:env.FRONTEND_ORIGIN || 'http://localhost:5173',documentKey:env.DOCUMENT_ENCRYPTION_KEY,uploadDir:env.UPLOAD_PRIVATE_DIR};
}
