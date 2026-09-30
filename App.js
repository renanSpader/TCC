import 'react-native-gesture-handler'; 
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

import Login from './Login';
import Cadastrar from './Cadastrar';
import Home from './Home';
import Tatuadores from './Tatuadores';
import Galeria from './Galeria';
import Avaliacoes from './Avaliacoes';
import Agendamento from './Agendamento';
import TelaAdm from './TelaAdm';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Conteúdo customizado do Drawer: mantém a lista padrão de telas
// (Home, Tatuadores, Galeria...) e acrescenta o item "Sair" no final.
function CustomDrawerContent(props) {
  // O Drawer está aninhado dentro do Stack (a tela "Home" do Stack é o
  // DrawerMenu). Por isso pegamos a navegação do Stack (getParent) para
  // poder usar replace() e trocar a tela sem deixar "Home" no histórico.
  const handleSair = () => {
    const navegacaoStack = props.navigation.getParent();
    if (navegacaoStack) {
      navegacaoStack.replace('Login');
    } else {
      props.navigation.navigate('Login');
    }
  };

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: '#0D0F13' }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <DrawerItemList {...props} />

      <DrawerItem
        label="Sair"
        onPress={handleSair}
        icon={({ size }) => (
          <Ionicons name="log-out-outline" size={size} color="#E0575A" />
        )}
        labelStyle={{
          fontSize: 14,
          fontWeight: 'bold',
          color: '#E0575A',
        }}
        style={{
          borderRadius: 10,
          marginHorizontal: 8,
          marginVertical: 3,
        }}
      />
    </DrawerContentScrollView>
  );
}

function DrawerMenu() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2F6FED',
        },
        headerTintColor: '#F5F6F8',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        drawerStyle: {
          backgroundColor: '#0D0F13',
          width: 260,
        },
        drawerActiveBackgroundColor: '#1B3A6B',
        drawerActiveTintColor: '#F5F6F8',
        drawerInactiveTintColor: '#8B929E',
        drawerLabelStyle: {
          fontSize: 14,
          fontWeight: 'bold',
        },
        drawerItemStyle: {
          borderRadius: 10,
          marginHorizontal: 8,
          marginVertical: 3,
        },
      }}
    >
      <Drawer.Screen name="Home" component={Home} options={{ title: 'Home' }} />
      <Drawer.Screen name="Tatuadores" component={Tatuadores} options={{ title: 'Tatuadores' }} />
      <Drawer.Screen name="Galeria" component={Galeria} options={{ title: 'Galeria' }} />
      <Drawer.Screen name="Avaliacoes" component={Avaliacoes} options={{ title: 'Avaliações' }} />
      <Drawer.Screen name="Agendamento" component={Agendamento} options={{ title: 'Agendamento' }} />
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Login"
          component={Login}
          options={{
            title: 'Login',
            headerStyle: { backgroundColor: '#2F6FED' },
            headerTintColor: '#F1E4C6',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen
          name="Cadastrar"
          component={Cadastrar}
          options={{
            title: 'Cadastrar',
            headerStyle: { backgroundColor: '#2F6FED' },
            headerTintColor: '#F1E4C6',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen
          name="TelaAdm"
          component={TelaAdm}
          options={{
            title: 'Painel Admin',
            headerStyle: { backgroundColor: '#2F6FED' },
            headerTintColor: '#F1E4C6',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen
          name="Home"
          component={DrawerMenu}
          options={{ headerShown: false }}
          
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}