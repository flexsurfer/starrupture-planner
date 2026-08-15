import { useNavigate } from 'react-router-dom';
import NavigationProvider from './navigation/NavigationProvider';
import TabLayout from './TabLayout';

const RouteWrapper = () => {
  const navigate = useNavigate();

  return (
    <NavigationProvider navigate={navigate}>
      <TabLayout />
    </NavigationProvider>
  );
};

export default RouteWrapper;
