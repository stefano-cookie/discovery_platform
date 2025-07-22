/**
 * Generate a unique ID of specified length
 */
export function generateUniqueId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Add timestamp suffix to ensure uniqueness
  const timestamp = Date.now().toString(36).toUpperCase();
  return result + timestamp.slice(-3);
}