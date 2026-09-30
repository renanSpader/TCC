import { useState, useEffect, useRef } from "react";
import {StyleSheet,Text,View,ScrollView,TouchableOpacity,Image,Animated,useWindowDimensions,ActivityIndicator,} from "react-native";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useFonts, Oswald_500Medium, Oswald_600SemiBold, Oswald_700Bold } from "@expo-google-fonts/oswald";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Ionicons } from "@expo/vector-icons";

// Ajuste este caminho conforme a localização real do seu firebaseConfig.js
import { db } from "./firebaseConfig";

// Imagens do carrossel de fundo do Hero
const heroImagens = [
  require("./assets/banner/banner01.jpeg"),
  require("./assets/banner/banner02.jpeg"),
  require("./assets/banner/banner03.jpeg"),
  require("./assets/banner/banner04.jpeg"),
  require("./assets/banner/banner05.jpeg"),
  require("./assets/banner/banner06.jpeg"),
  require("./assets/banner/banner07.jpeg"),
  require("./assets/banner/banner08.jpeg"),
  
];

export default function Home({ navigation }) {
  // Carrega as fontes do estúdio: Oswald para títulos/destaques, Inter para textos corridos
  const [fontsLoaded] = useFonts({
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Pega a largura da tela em tempo real (se recalcula ao girar o aparelho, etc.)
  const { width } = useWindowDimensions();
  const isSmall = width < 380; // celulares mais estreitos (ex: iPhone SE)

  // Controle do carrossel de fundo do Hero
  const [heroIndex, setHeroIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const intervalo = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setHeroIndex((prev) => (prev + 1) % heroImagens.length);
        // Fade in com a nova imagem
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      });
    }, 5000); // troca a cada 5 segundos

    return () => clearInterval(intervalo);
  }, [fadeAnim]);

  // Tatuadores em destaque, vindos direto do Firestore (mesma coleção da TelaADM)
  const [tatuadores, setTatuadores] = useState([]);
  const [carregandoTatuadores, setCarregandoTatuadores] = useState(true);

  // Avaliações de todos os tatuadores, usadas só para calcular a média de cada um
  // que aparece no card do tatuador aqui na Home. A lista individual de comentários
  // agora só é exibida na tela Tatuadores (modal "Ver avaliações").
  const [avaliacoes, setAvaliacoes] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "tatuadores"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setTatuadores(lista);
        setCarregandoTatuadores(false);
      },
      (err) => {
        console.error("Erro ao carregar tatuadores:", err);
        setCarregandoTatuadores(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Escuta a coleção "avaliacoes" (a mesma criada pela tela Avaliacoes.js)
  useEffect(() => {
    const q = query(collection(db, "avaliacoes"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setAvaliacoes(lista);
    });
    return () => unsubscribe();
  }, []);

  // Calcula a média e a quantidade de avaliações de um tatuador específico
  const calcularMedia = (tatuadorId) => {
    const doTatuador = avaliacoes.filter((a) => a.tatuadorId === tatuadorId);
    if (doTatuador.length === 0) return null;
    const soma = doTatuador.reduce((total, a) => total + Number(a.nota || 0), 0);
    return {
      media: (soma / doTatuador.length).toFixed(1),
      quantidade: doTatuador.length,
    };
  };

  // Largura do card de tatuador calculada a partir da tela, com limites mín/máx.
  // Evita cards espremidos em telas pequenas e cards enormes em telas grandes.
  const larguraCardTatuador = Math.min(150, Math.max(110, width * 0.34));

  // Enquanto as fontes não carregam, evita mostrar a tela com a fonte padrão do sistema
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#2F6FED" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Cabeçalho com a logo do estúdio */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>ESTÚDIO DE TATUAGEM</Text>

        <View style={styles.logoLinha}>
          <Text style={[styles.logoAV, isSmall && styles.logoAVSmall]}>AV</Text>
          <Text style={[styles.logoTattoo, isSmall && styles.logoTattooSmall]}>
            TATTOO
          </Text>
        </View>

        <View style={styles.logoOrnamento}>
          <View style={styles.logoLinhaLateral} />
          <View style={styles.logoDiamante} />
          <View style={styles.logoLinhaLateral} />
        </View>

        <Text style={styles.headerTagline}>ARTE  •  ESTILO  •  ATITUDE</Text>
      </View>

      {/* Seção principal (hero) com carrossel de fotos do estúdio, título e botões de ação */}
      <View style={styles.hero}>
        {/* Imagem de fundo animada (carrossel) */}
        <Animated.Image
          source={heroImagens[heroIndex]}
          style={[styles.heroImagemFundo, { opacity: fadeAnim }]}
          resizeMode="cover"
        />
        {/* Camada escura por cima da foto, pra manter o texto legível */}
        <View style={styles.heroOverlay} />

        {/* Conteúdo do hero (texto e botões) por cima da imagem */}
        <View style={styles.heroConteudo}>
          <Text style={[styles.heroTitulo, isSmall && styles.heroTituloSmall]}>
            ARTE NA PELE,{"\n"}PARA SEMPRE
          </Text>
          <Text style={styles.heroSubtitulo}>
            Transformamos ideias em tatuagens únicas, com os melhores artistas e
            a mais alta qualidade.
          </Text>

          <View style={[styles.heroBotoes, isSmall && styles.heroBotoesSmall]}>
            <TouchableOpacity
              style={[styles.botaoPrimario, isSmall && styles.botaoFullWidth]}
              onPress={() => navigation.navigate("Agendamento")}
            >
              <Text
                style={styles.textoBotaoPrimario}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                AGENDAR HORÁRIO
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botaoSecundario, isSmall && styles.botaoFullWidth]}
              onPress={() => navigation.navigate("Galeria")}
            >
              <Text
                style={styles.textoBotaoSecundario}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                VER GALERIA
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Diferenciais do estúdio, exibidos como cartões com ícone + texto */}
      <View style={[styles.diferenciais, isSmall && styles.diferenciaisSmall]}>
        <View
          style={[
            styles.diferencialItem,
            isSmall && styles.diferencialItemSmall,
          ]}
        >
          <View style={styles.diferencialIconeCirculo}>
            <Ionicons name="ribbon-outline" size={22} color="#2F6FED" />
          </View>
          <Text style={styles.diferencialTitulo}>Artistas Premiados</Text>
          <Text style={styles.diferencialTexto}>
            Profissionais reconhecidos no mercado
          </Text>
        </View>

        <View
          style={[
            styles.diferencialItem,
            isSmall && styles.diferencialItemSmall,
          ]}
        >
          <View style={styles.diferencialIconeCirculo}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#2F6FED" />
          </View>
          <Text style={styles.diferencialTitulo}>Material Esterilizado</Text>
          <Text style={styles.diferencialTexto}>
            Segurança e higiene em primeiro lugar
          </Text>
        </View>

        <View
          style={[
            styles.diferencialItem,
            isSmall && styles.diferencialItemSmall,
          ]}
        >
          <View style={styles.diferencialIconeCirculo}>
            <Ionicons name="diamond-outline" size={22} color="#2F6FED" />
          </View>
          <Text style={styles.diferencialTitulo}>Ambiente Exclusivo</Text>
          <Text style={styles.diferencialTexto}>
            Espaço pensado para o seu conforto
          </Text>
        </View>
      </View>

      {/* Seção com os tatuadores do estúdio */}
      <View style={[styles.secao, styles.ultimaSecao]}>
        <View style={styles.secaoHeader}>
          <Text style={styles.secaoTitulo}>NOSSOS TATUADORES</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Tatuadores")}>
            <Text style={styles.verTodos}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {carregandoTatuadores ? (
          <ActivityIndicator color="#2F6FED" style={{ marginVertical: 12 }} />
        ) : tatuadores.length === 0 ? (
          <Text style={styles.semDados}>Em breve novos artistas por aqui.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tatuadores.map((item) => {
              const resultado = calcularMedia(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.cardTatuador, { width: larguraCardTatuador }]}
                  onPress={() => navigation.navigate("Tatuadores")}
                >
                  {/* Foto do tatuador vinda do Firestore, com placeholder de reserva */}
                  {item.foto ? (
                    <Image source={{ uri: item.foto }} style={styles.fotoTatuador} />
                  ) : (
                    <View style={styles.fotoTatuador} />
                  )}
                  <Text style={styles.nomeTatuador} numberOfLines={1}>
                    {item.nome}
                  </Text>
                  <Text style={styles.especialidadeTatuador} numberOfLines={1}>
                    {item.especialidade}
                  </Text>
                  {resultado ? (
                    <Text style={styles.avaliacaoTatuador}>
                      ★ {resultado.media} ({resultado.quantidade})
                    </Text>
                  ) : (
                    <Text style={styles.semAvaliacaoTatuador}>Sem avaliações</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#05060A",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#05060A",
    alignItems: "center",
    justifyContent: "center",
  },

  // Cabeçalho
  header: {
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#20242C",
    backgroundColor: "#0D0F13",
    position: "relative",
  },
  headerEyebrow: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 4,
    color: "#2F6FED",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  logoLinha: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  logoAV: {
    fontSize: 34,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 3,
    color: "#2F6FED",
    textTransform: "uppercase",
    marginRight: 10,
  },
  logoAVSmall: {
    fontSize: 26,
  },
  logoTattoo: {
    fontSize: 34,
    fontFamily: "Oswald_700Bold",
    letterSpacing: 8,
    color: "#F5F6F8",
    textTransform: "uppercase",
  },
  logoTattooSmall: {
    fontSize: 26,
    letterSpacing: 5,
  },
  logoOrnamento: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  logoLinhaLateral: {
    width: 36,
    height: 1,
    backgroundColor: "#2F6FED",
  },
  logoDiamante: {
    width: 7,
    height: 7,
    backgroundColor: "#2F6FED",
    marginHorizontal: 8,
    transform: [{ rotate: "45deg" }],
    borderRadius: 1,
  },
  headerTagline: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 2.5,
    color: "#8B929E",
  },
  // Hero
  hero: {
    paddingHorizontal: 30,
    paddingVertical: 50,
    alignItems: "flex-start",
    backgroundColor: "#000000",
    position: "relative",
    overflow: "hidden",
    minHeight: 420, // dá espaço suficiente pra imagem não cortar tanto
    justifyContent: "center", // centraliza o texto verticalmente no espaço extra
  },
  // Imagem de fundo do carrossel, preenchendo todo o Hero
  heroImagemFundo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  // Camada escura por cima da imagem, mantendo contraste do texto
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5, 6, 10, 0.72)",
  },
  // Conteúdo (texto/botões) acima da imagem e do overlay
  heroConteudo: {
    width: "100%",
    alignItems: "flex-start",
  },
  heroTitulo: {
    fontSize: 32,
    fontFamily: "Oswald_700Bold",
    color: "#F5F6F8",
    lineHeight: 38,
    marginBottom: 14,
  },
  // Em telas estreitas, reduz a fonte pra não estourar a largura nem quebrar feio
  heroTituloSmall: {
    fontSize: 26,
    lineHeight: 32,
  },
  heroSubtitulo: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#A7ADB8",
    lineHeight: 20,
    marginBottom: 24,
  },
  heroBotoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  },
  // Em telas estreitas os botões empilham (um embaixo do outro) em vez de espremer lado a lado
  heroBotoesSmall: {
    flexDirection: "column",
  },
  botaoPrimario: {
    backgroundColor: "#1B3A6B",
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 8,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2F6FED",
    alignItems: "center",
    shadowColor: "#2F6FED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  botaoFullWidth: {
    width: "100%",
    marginRight: 0,
  },
  textoBotaoPrimario: {
    color: "#F5F6F8",
    fontFamily: "Oswald_600SemiBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  botaoSecundario: {
    backgroundColor: "rgba(21, 24, 30, 0.6)",
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#3A3F4A",
    alignItems: "center",
  },
  textoBotaoSecundario: {
    color: "#F5F6F8",
    fontFamily: "Oswald_600SemiBold",
    fontSize: 13,
    letterSpacing: 1,
  },

  // Diferenciais
  diferenciais: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 26,
    backgroundColor: "#0D0F13",
    borderBottomWidth: 1,
    borderBottomColor: "#20242C",
    gap: 10,
  },
  // Em telas estreitas, empilha os 3 itens em coluna pra dar espaço ao texto
  diferenciaisSmall: {
    flexDirection: "column",
  },
  diferencialItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#15181E",
    borderWidth: 1,
    borderColor: "#20242C",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  diferencialItemSmall: {
    width: "100%",
  },
  diferencialIconeCirculo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#2F6FED",
    backgroundColor: "rgba(47, 111, 237, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  diferencialTitulo: {
    color: "#F5F6F8",
    fontSize: 12,
    fontFamily: "Oswald_600SemiBold",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  diferencialTexto: {
    color: "#8B929E",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 15,
  },

  // Seções genéricas
  secao: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  // Última seção da tela: dá um respiro maior embaixo
  ultimaSecao: {
    paddingBottom: 40,
  },
  secaoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  secaoTitulo: {
    color: "#F5F6F8",
    fontSize: 14,
    fontFamily: "Oswald_600SemiBold",
    letterSpacing: 2,
    flexShrink: 1,
    marginRight: 8,
  },
  verTodos: {
    color: "#2F6FED",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  semDados: {
    color: "#8B929E",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  // Cards dos tatuadores (a largura agora vem de style inline calculado por useWindowDimensions)
  cardTatuador: {
    marginRight: 14,
    backgroundColor: "#0D0F13",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#20242C",
    padding: 12,
    alignItems: "center",
  },
  fotoTatuador: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#15181E",
    borderWidth: 1.5,
    borderColor: "#2F6FED",
    marginBottom: 10,
  },
  nomeTatuador: {
    color: "#F5F6F8",
    fontSize: 13,
    fontFamily: "Oswald_600SemiBold",
    textAlign: "center",
    width: "100%",
  },
  especialidadeTatuador: {
    color: "#8B929E",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 6,
    width: "100%",
  },
  avaliacaoTatuador: {
    color: "#2F6FED",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  semAvaliacaoTatuador: {
    color: "#6B7280",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
  },
});