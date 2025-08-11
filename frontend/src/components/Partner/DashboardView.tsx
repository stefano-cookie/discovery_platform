import React from 'react';
import ImprovedPartnerDashboard from './ImprovedDashboard';

interface DashboardViewProps {
  onNavigateToUsers?: () => void;
  onNavigateToEnrollmentDetail?: (registrationId: string) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ 
  onNavigateToUsers, 
  onNavigateToEnrollmentDetail 
}) => {
  // Use the new improved dashboard component with real data
  return <ImprovedPartnerDashboard />;
};

export default DashboardView;