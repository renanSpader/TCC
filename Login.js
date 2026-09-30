import { useState } from "react";
import {StyleSheet,Text,View,TextInput,TouchableOpacity,ImageBackground,Image,Alert,} from "react-native";

import { auth, db } from "./firebaseConfig";

import { signInWithEmailAndPassword } from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";
import logo from "./assets/logoLOGIN.jpeg";

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  // Guarda as mensagens de erro de cada campo para mostrar embaixo do input
  const [erroEmail, setErroEmail] = useState("");
  const [erroSenha, setErroSenha] = useState("");

  // Valida os campos antes de mandar pro Firebase.
  // Retorna true se estiver tudo certo, false se tiver algum erro.
  const validarCampos = () => {
    let valido = true;
    setErroEmail("");
    setErroSenha("");

    if (email.trim() === "") {
      setErroEmail("Preencha o campo de e-mail.");
      valido = false;
    } else if (!email.toLowerCase().includes("@gmail.com")) {
      setErroEmail('O e-mail deve conter "@gmail.com".');
      valido = false;
    }

    if (senha === "") {
      setErroSenha("Preencha o campo de senha.");
      valido = false;
    } else if (senha.length < 6) {
      setErroSenha("A senha deve ter no mínimo 6 caracteres.");
      valido = false;
    }

    return valido;
  };

  const EntrarConta = () => {
    if (!validarCampos()) {
      return;
    }

    signInWithEmailAndPassword(auth, email, senha)
      .then(async (userCredential) => {
        const uid = userCredential.user.uid;
        console.log(uid);

        try {
          // Busca o documento do usuário na coleção "usuarios" usando o UID
          const docRef = doc(db, "usuarios", uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const dadosUsuario = docSnap.data();

            if (dadosUsuario.tipo === "admin") {
              // Usuário é administrador
              navigation.navigate("TelaAdm");
            } else {
              // Usuário é cliente comum
              navigation.navigate("Home");
            }
          } else {
            // Usuário autenticado no Firebase Auth, mas sem documento no Firestore
            Alert.alert(
              "Erro",
              "Usuário não cadastrado no sistema. Fale com o suporte."
            );
          }
        } catch (error) {
          console.log("Erro ao buscar dados do usuário:", error);
          Alert.alert("Erro", "Não foi possível verificar seu perfil.");
        }
      })
      .catch((error) => {
        console.log(error);

        switch (error.code) {
          case "auth/invalid-email":
            setErroEmail("E-mail inválido.");
            Alert.alert("Erro", "E-mail inválido.");
            break;

          case "auth/invalid-credential":
            setErroSenha("E-mail ou senha incorretos.");
            Alert.alert("Erro", "E-mail ou senha incorretos.");
            break;

          case "auth/user-not-found":
            setErroEmail("Usuário não encontrado.");
            Alert.alert("Erro", "Usuário não encontrado.");
            break;

          case "auth/wrong-password":
            setErroSenha("Senha incorreta.");
            Alert.alert("Erro", "Senha incorreta.");
            break;

          default:
            Alert.alert("Erro", error.message);
        }
      });
  };

  return (
    <ImageBackground source={null} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.logoWrapper}>
            <Image source={logo} style={styles.logoImagem} />
            <View style={styles.logoRing} />
          </View>

          <Text style={styles.logo}>AV TATTOO</Text>
          <View style={styles.logoUnderline} />

          <Text style={styles.subtitulo}>Faça login para continuar</Text>

          <TextInput
            style={[styles.input, erroEmail ? styles.inputErro : null]}
            placeholder="E-Mail"
            placeholderTextColor="#6B7280"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (erroEmail) setErroEmail("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {erroEmail ? <Text style={styles.textoErro}>{erroEmail}</Text> : null}

          <View
            style={[
              styles.inputSenhaContainer,
              erroSenha ? styles.inputErro : null,
            ]}
          >
            <TextInput
              style={styles.inputSenha}
              placeholder="Senha"
              placeholderTextColor="#6B7280"
              value={senha}
              onChangeText={(text) => {
                setSenha(text);
                if (erroSenha) setErroSenha("");
              }}
              secureTextEntry={!senhaVisivel}
            />
          </View>
          {erroSenha ? <Text style={styles.textoErro}>{erroSenha}</Text> : null}

          <TouchableOpacity
            style={styles.botaoEntrar}
            onPress={EntrarConta}
            activeOpacity={0.85}
          >
            <Text style={styles.textoBotao}>ENTRAR</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Cadastrar")}>
            <Text style={styles.linkCadastro}>
              Não tem conta? <Text style={styles.linkNegrito}>Cadastre-se</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#05060A",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(5,6,10,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },

  container: {
    width: "86%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: "#0D0F13",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#20242C",
    shadowColor: "#2F6FED",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },

  logoWrapper: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  logoImagem: {
    width: 116,
    height: 116,
    borderRadius: 58,
    resizeMode: "cover",
  },

  logoRing: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1.5,
    borderColor: "#2F6FED",
    opacity: 0.55,
  },

  logo: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 6,
    color: "#F5F6F8",
    textTransform: "uppercase",
  },

  logoUnderline: {
    width: 42,
    height: 2,
    backgroundColor: "#2F6FED",
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 18,
  },

  titulo: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#F5F6F8",
    marginBottom: 6,
    textAlign: "center",
  },

  subtitulo: {
    fontSize: 13,
    color: "#8B929E",
    marginBottom: 28,
    textAlign: "center",
    letterSpacing: 0.3,
  },

  input: {
    width: "100%",
    height: 52,
    backgroundColor: "#15181E",
    borderRadius: 10,
    paddingHorizontal: 16,
    marginVertical: 8,
    fontSize: 15,
    color: "#F5F6F8",
    borderWidth: 1,
    borderColor: "#262A33",
  },

  // Borda em tom de alerta discreto quando o campo estiver com erro
  inputErro: {
    borderColor: "#E0575A",
  },

  // Texto de erro embaixo do campo
  textoErro: {
    width: "100%",
    color: "#E0575A",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 4,
    alignSelf: "flex-start",
  },

  inputSenhaContainer: {
    width: "100%",
    height: 52,
    backgroundColor: "#15181E",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#262A33",
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  inputSenha: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#F5F6F8",
  },

  botaoEntrar: {
    width: "100%",
    backgroundColor: "#1B3A6B",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 22,
    borderWidth: 1,
    borderColor: "#2F6FED",
    shadowColor: "#2F6FED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },

  textoBotao: {
    color: "#F5F6F8",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 2.5,
  },

  linkCadastro: {
    marginTop: 20,
    textAlign: "center",
    color: "#8B929E",
    fontSize: 13,
  },

  linkNegrito: {
    color: "#2F6FED",
    fontWeight: "700",
  },
});