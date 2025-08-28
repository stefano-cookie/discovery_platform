// Utility functions per triggare refresh di componenti specifici

export const triggerCertificationStepsRefresh = () => {
  console.log('Triggering certification steps refresh');
  window.dispatchEvent(new Event('refreshCertificationSteps'));
};

export const triggerRegistrationsRefresh = () => {
  console.log('Triggering registrations refresh');
  window.dispatchEvent(new Event('refreshRegistrations'));
};