import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CameraScreen from './src/screens/CameraScreen';
import EditScreen from './src/screens/EditScreen';
import FormScreen from './src/screens/FormScreen';
import PreviewScreen from './src/screens/PreviewScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Camera">
        <Stack.Screen
          name="Camera"
          component={CameraScreen}
          options={{ title: 'Scanner', headerShown: false }}
        />
        <Stack.Screen
          name="Edit"
          component={EditScreen}
          options={{ title: 'Retouche', headerStyle: { backgroundColor: '#1a1a1a' }, headerTintColor: '#fff' }}
        />
        <Stack.Screen
          name="Form"
          component={FormScreen}
          options={{ title: 'Détails' }}
        />
        <Stack.Screen
          name="Preview"
          component={PreviewScreen}
          options={{ title: 'Aperçu & Sauvegarde' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
