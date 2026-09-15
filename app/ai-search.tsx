import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AISearchRedirect() {
  const params = useLocalSearchParams();
  // Forward any params (like `q`) to the new unified search
  return <Redirect href={{ pathname: '/search', params } as any} />;
}
