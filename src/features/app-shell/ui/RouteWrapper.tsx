import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { initializeTools } from '@/platform/web/bootstrap';
import NavigationProvider from './navigation/NavigationProvider';
import TabLayout from './TabLayout';
import type { ToolShellOptions } from './ToolShellOptions';

const RouteWrapper = (props: ToolShellOptions) => {
  const navigate = useNavigate();
  useEffect(initializeTools, []);

  return (
    <NavigationProvider navigate={navigate}>
      <TabLayout {...props} />
    </NavigationProvider>
  );
};

export default RouteWrapper;
