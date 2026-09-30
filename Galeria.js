import { useState, useEffect } from "react";
import {StyleSheet,Text,View,ScrollView,TouchableOpacity,Image,ActivityIndicator,useWindowDimensions,} from "react-native";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

// Ajuste este caminho conforme a localização real do seu firebaseConfig.js
import { db } from "./firebaseConfig";

export default function Galeria({ navigation }) {
  const categorias = [
    "Todas",
    "Delicadas",
    "Preto e Cinza",
    "Lettering",
    "Blackwork",
    "Old School",
  ];
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");
  const { width: larguraTela } = useWindowDimensions();
  const [proporcoesImagens, setProporcoesImagens] = useState({});

  // Imagens vindas da coleção "galeria" no Firestore — a mesma que o Admin
  // alimenta em TelaAdm.js, já com o campo "categoria" preenchido lá.
  const [galeria, setGaleria] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "galeria"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setGaleria(lista);
        setCarregando(false);
      },
      (err) => {
        console.error("Erro ao carregar galeria:", err);
        setCarregando(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const galeriaFiltrada =
    categoriaAtiva === "Todas"
      ? galeria
      : galeria.filter((item) => item.categoria === categoriaAtiva);

  const colunas = larguraTela >= 1200 ? 4 : larguraTela >= 760 ? 3 : 2;
  const espacamento = 14;
  const larguraGrade = Math.min(larguraTela, 1400) - 40;
  const larguraItem = Math.max(
    0,
    (larguraGrade - (colunas - 1) * espacamento) / colunas,
  );

  const atualizarProporcao = (id, evento) => {
    // No nativo (iOS/Android), as dimensões vêm em nativeEvent.source.
    // No Web, o elemento <img> entrega em nativeEvent.target (naturalWidth/naturalHeight).
    const fonte = evento?.nativeEvent?.source;
    const alvo = evento?.nativeEvent?.target;

    const width = fonte?.width ?? alvo?.naturalWidth;
    const height = fonte?.height ?? alvo?.naturalHeight;

    if (!width || !height) return;

    setProporcoesImagens((atual) => {
      const proporcao = width / height;
      if (atual[id] === proporcao) return atual;
      return { ...atual, [id]: proporcao };
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.titulo}>GALERIA DE TATUAGENS</Text>
        <View style={styles.tituloUnderline} />
        <Text style={styles.subtitulo}>
          Alguns dos nossos trabalhos mais recentes
        </Text>
      </View>

      {/* Filtro de categorias */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtros}
        contentContainerStyle={styles.filtrosConteudo}
      >
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, categoriaAtiva === cat && styles.chipAtivo]}
            onPress={() => setCategoriaAtiva(cat)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.chipTexto,
                categoriaAtiva === cat && styles.chipTextoAtivo,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grade de fotos */}
      {carregando ? (
        <ActivityIndicator color="#2F6FED" style={{ marginTop: 30 }} />
      ) : (
        <>
          <View style={styles.grade}>
            {galeriaFiltrada.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemGaleria,
                  {
                    width: larguraItem,
                    aspectRatio: proporcoesImagens[item.id] || 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                {item.imagem ? (
                  <Image
                    source={{ uri: item.imagem }}
                    style={styles.imagemFundo}
                    resizeMode="contain"
                    onLoad={(evento) => atualizarProporcao(item.id, evento)}
                  />
                ) : null}
                {item.categoria ? (
                  <Text style={styles.legendaEstilo}>{item.categoria}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          {galeriaFiltrada.length === 0 && (
            <Text style={styles.vazio}>
              Nenhuma tatuagem encontrada nessa categoria.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#05060A",
  },
  header: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#20242C",
  },
  titulo: {
    color: "#F5F6F8",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  tituloUnderline: {
    width: 42,
    height: 2,
    backgroundColor: "#2F6FED",
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 12,
  },
  subtitulo: {
    color: "#8B929E",
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  filtros: {
    marginTop: 18,
  },
  filtrosConteudo: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#262A33",
    marginRight: 10,
    backgroundColor: "#15181E",
  },
  chipAtivo: {
    backgroundColor: "#1B3A6B",
    borderColor: "#2F6FED",
    shadowColor: "#2F6FED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  chipTexto: {
    color: "#8B929E",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextoAtivo: {
    color: "#F5F6F8",
  },
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 14,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
    width: "100%",
    maxWidth: 1440,
    alignSelf: "center",
  },
  itemGaleria: {
    backgroundColor: "#0D0F13",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#20242C",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 8,
    overflow: "hidden",
    shadowColor: "#2F6FED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  imagemFundo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#0D0F13",
  },
  legendaEstilo: {
    color: "#F5F6F8",
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "rgba(5, 6, 10, 0.75)",
    borderWidth: 1,
    borderColor: "#2F6FED",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  vazio: {
    color: "#8B929E",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 30,
  },
});
