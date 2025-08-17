export interface EmailAuthorizationResult {
  isAuthorized: boolean;
  error?: string;
}

export function isEmailAuthorized(email: string): EmailAuthorizationResult {
  if (!email) {
    return {
      isAuthorized: false,
      error: 'Email address is required'
    };
  }

  const authorizedEmails = process.env.AUTHORIZED_EMAILS;

  // If no authorized emails are configured, allow all authenticated users
  // This provides backward compatibility and prevents lockout
  if (!authorizedEmails || authorizedEmails.trim() === '') {
    console.warn('AUTHORIZED_EMAILS environment variable not set - allowing all authenticated users');
    return {
      isAuthorized: true
    };
  }

  // Parse and normalize authorized emails
  const emailList = authorizedEmails
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0);

  if (emailList.length === 0) {
    console.warn('AUTHORIZED_EMAILS environment variable is empty - allowing all authenticated users');
    return {
      isAuthorized: true
    };
  }

  // Validate that we have properly formatted emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = emailList.filter(email => !emailRegex.test(email));
  
  if (invalidEmails.length > 0) {
    console.warn('Invalid email addresses found in AUTHORIZED_EMAILS:', invalidEmails);
  }

  // Check if user's email is in the authorized list (case-insensitive)
  const normalizedUserEmail = email.trim().toLowerCase();
  const isAuthorized = emailList.includes(normalizedUserEmail);

  return {
    isAuthorized,
    error: isAuthorized ? undefined : 'Your email address is not authorized to access this application'
  };
}

export function getAuthorizedEmailsList(): Array<string> {
  const authorizedEmails = process.env.AUTHORIZED_EMAILS;
  
  if (!authorizedEmails || authorizedEmails.trim() === '') {
    return [];
  }

  return authorizedEmails
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0);
}