import React, { useState, useEffect } from "react";
import {View,Text,TextInput,TouchableOpacity,Image,ScrollView,StyleSheet,Platform,ActivityIndicator,Linking,} from "react-native";
import {collection,addDoc,deleteDoc,doc,onSnapshot,query,orderBy,serverTimestamp,where,getDocs,} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// Ajuste este caminho conforme a localização real do seu firebaseConfig.js
import { db } from "./firebaseConfig";

// Paleta baseada no mesmo design escuro/azul usado no Login
const palette = {
  bg: "#05060A",
  panel: "#0D0F13",
  panelAlt: "#15181E",
  border: "#20242C",
  maroon: "#1B3A6B",
  maroonDark: "#153058",
  maroonLight: "#2F6FED",
  gold: "#2F6FED",
  goldSoft: "#5A8EF5",
  textPrimary: "#F5F6F8",
  textSecondary: "#8B929E",
  textMuted: "#6B7280",
  danger: "#E0575A",
};

// Nome das coleções no Firestore. As telas de cliente (Home, Galeria, Agendamento) devem
// ler/escrever nessas mesmas coleções.
const TATUADORES_COLLECTION = "tatuadores";
const GALERIA_COLLECTION = "galeria";
const AGENDAMENTOS_COLLECTION = "agendamentos";

// Categorias exibidas como filtro na tela de Galeria do cliente.
// Se você adicionar/renomear uma categoria lá, replique a mudança aqui também.
const CATEGORIAS_GALERIA = ["Delicadas", "Preto e Cinza", "Lettering", "Blackwork", "Old School"];

// Quantidade de avaliações mostradas por padrão antes do usuário
// clicar em "Ver todas". Evita renderizar milhares de itens de uma vez.
const LIMITE_AVALIACOES_VISIVEIS = 2;

// Mesma ideia, mas para a lista de agendamentos.
const LIMITE_AGENDAMENTOS_VISIVEIS = 3;

// Mesma ideia, mas para a lista de imagens enviadas da galeria.
const LIMITE_GALERIA_VISIVEIS = 5;

function StatCard({ value, label }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function TelaAdm({ navigation }) {
  const [tatuadores, setTatuadores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  // Galeria agora vem do Firestore em tempo real (antes era um array fixo local)
  const [galeria, setGaleria] = useState([]);
  const [carregandoGaleria, setCarregandoGaleria] = useState(true);
  const [enviandoGaleria, setEnviandoGaleria] = useState(false);

  // Imagens escolhidas pelo admin que ainda não foram confirmadas/enviadas,
  // e a categoria selecionada para esse lote (usada no filtro da Galeria do cliente).
  const [imagensPendentes, setImagensPendentes] = useState([]); // [{ uri, base64 }]
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(CATEGORIAS_GALERIA[0]);

  const [form, setForm] = useState({
    nome: "",
    apelido: "",
    especialidade: "",
    instagram: "",
    bio: "",
  });

  // Guarda a imagem escolhida no aparelho/computador antes do upload
  const [fotoSelecionada, setFotoSelecionada] = useState(null); // { uri, ... }
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  // Avaliações de clientes, para o admin poder gerenciar/excluir
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [carregandoAvaliacoes, setCarregandoAvaliacoes] = useState(true);

  // Controla se a lista de avaliações está expandida (mostrando todas)
  // ou reduzida (mostrando só as primeiras LIMITE_AVALIACOES_VISIVEIS).
  const [mostrarTodasAvaliacoes, setMostrarTodasAvaliacoes] = useState(false);

  // Agendamentos feitos pelos clientes na tela "Agendamento", em tempo real.
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregandoAgendamentos, setCarregandoAgendamentos] = useState(true);
  const [mostrarTodosAgendamentos, setMostrarTodosAgendamentos] = useState(false);
  const [imagemAmpliada, setImagemAmpliada] = useState(null);

  // Controla se a galeria está expandida (todas as imagens) ou reduzida.
  const [mostrarTodaGaleria, setMostrarTodaGaleria] = useState(false);

  // Escuta a coleção "tatuadores" no Firestore em tempo real.
  // Qualquer cadastro feito aqui aparece automaticamente na tela de clientes
  // que também estiver "escutando" essa mesma coleção.
  useEffect(() => {
    const q = query(
      collection(db, TATUADORES_COLLECTION),
      orderBy("criadoEm", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setTatuadores(lista);
        setCarregando(false);
      },
      (err) => {
        console.error("Erro ao carregar tatuadores:", err);
        setErro("Não foi possível carregar os tatuadores.");
        setCarregando(false);
      }
    );

    // Cancela a escuta quando o componente desmontar
    return () => unsubscribe();
  }, []);

  // Escuta a coleção "galeria" no Firestore em tempo real, para a lista de
  // imagens aparecer aqui e a Home poder escutar a mesma coleção.
  useEffect(() => {
    const q = query(collection(db, GALERIA_COLLECTION), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setGaleria(lista);
        setCarregandoGaleria(false);
      },
      (err) => {
        console.error("Erro ao carregar galeria:", err);
        setErro("Não foi possível carregar a galeria.");
        setCarregandoGaleria(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Escuta a coleção "avaliacoes" (criada pela tela Avaliacoes.js), para o
  // admin conseguir ver e excluir avaliações no painel.
  useEffect(() => {
    const q = query(collection(db, "avaliacoes"), orderBy("criadoEm", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setAvaliacoes(lista);
        setCarregandoAvaliacoes(false);
      },
      (err) => {
        console.error("Erro ao carregar avaliações:", err);
        setCarregandoAvaliacoes(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Escuta a coleção "agendamentos" (criada pela tela Agendamento.js do cliente),
  // para o admin ver em tempo real cada pedido de horário assim que é confirmado.
  // Ordenado do mais antigo para o mais novo: quem enviou o pedido primeiro
  // aparece no topo da lista, com prioridade de atendimento.
  useEffect(() => {
    const q = query(collection(db, AGENDAMENTOS_COLLECTION), orderBy("criadoEm", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setAgendamentos(lista);
        setCarregandoAgendamentos(false);
      },
      (err) => {
        console.error("Erro ao carregar agendamentos:", err);
        setErro("Não foi possível carregar os agendamentos.");
        setCarregandoAgendamentos(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleChange = (field) => (text) =>
    setForm((f) => ({ ...f, [field]: text }));

  // Abre a galeria/arquivos do aparelho (ou do computador, quando rodando na web)
  // para o usuário escolher uma foto do tatuador.
  const escolherImagem = async () => {
    setErro(null);

    if (Platform.OS !== "web") {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        setErro("Precisamos de permissão para acessar suas fotos.");
        return;
      }
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
      try {
        setEnviandoFoto(true);
        // Redimensiona e comprime a imagem para caber tranquilamente
        // dentro do limite de 1MB de um documento do Firestore.
        const manipulada = await ImageManipulator.manipulateAsync(
          resultado.assets[0].uri,
          [{ resize: { width: 400 } }],
          {
            compress: 0.5,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );
        setFotoSelecionada({
          uri: manipulada.uri,
          base64: manipulada.base64,
        });
      } catch (err) {
        console.error("Erro ao processar imagem:", err);
        setErro("Não foi possível processar a imagem selecionada.");
      } finally {
        setEnviandoFoto(false);
      }
    }
  };

  const removerFotoSelecionada = () => setFotoSelecionada(null);

  const handleCadastrar = async () => {
    if (!form.nome.trim()) return;

    setSalvando(true);
    setErro(null);
    try {
      // A foto já foi redimensionada/comprimida em escolherImagem();
      // aqui só montamos a data URI para salvar como texto no Firestore.
      const fotoUrl = fotoSelecionada
        ? `data:image/jpeg;base64,${fotoSelecionada.base64}`
        : null;

      await addDoc(collection(db, TATUADORES_COLLECTION), {
        nome: form.nome.trim(),
        apelido: form.apelido.trim(),
        especialidade: form.especialidade.trim() || "-",
        instagram: form.instagram.trim() || "-",
        bio: form.bio.trim(),
        foto: fotoUrl,
        criadoEm: serverTimestamp(),
      });
      setForm({ nome: "", apelido: "", especialidade: "", instagram: "", bio: "" });
      setFotoSelecionada(null);
    } catch (err) {
      console.error("Erro ao cadastrar tatuador:", err);
      setErro("Não foi possível cadastrar o tatuador. Tente novamente.");
    } finally {
      setSalvando(false);
      setEnviandoFoto(false);
    }
  };

  const handleCancelar = () => {
    setForm({ nome: "", apelido: "", especialidade: "", instagram: "", bio: "" });
    setFotoSelecionada(null);
  };

  const removerTatuador = async (id) => {
    try {
      // Apaga também as avaliações desse tatuador, para não ficarem
      // "órfãs" aparecendo pro cliente depois que ele sai do estúdio.
      const q = query(collection(db, "avaliacoes"), where("tatuadorId", "==", id));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));

      await deleteDoc(doc(db, TATUADORES_COLLECTION, id));
    } catch (err) {
      console.error("Erro ao remover tatuador:", err);
      setErro("Não foi possível remover o tatuador.");
    }
  };

  // Exclui uma avaliação específica (ex: comentário ofensivo, tatuador que já saiu, etc.)
  const removerAvaliacao = async (id) => {
    try {
      await deleteDoc(doc(db, "avaliacoes", id));
    } catch (err) {
      console.error("Erro ao remover avaliação:", err);
      setErro("Não foi possível remover a avaliação.");
    }
  };

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

  // Abre a galeria do aparelho/computador permitindo escolher várias imagens
  // de uma vez. As imagens ficam em uma prévia (imagensPendentes) até o admin
  // escolher a categoria e clicar em "Confirmar Envio" — nada é salvo ainda.
  const escolherImagensGaleria = async () => {
    setErro(null);

    if (Platform.OS !== "web") {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        setErro("Precisamos de permissão para acessar suas fotos.");
        return;
      }
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
    });

    if (resultado.canceled || !resultado.assets || resultado.assets.length === 0) {
      return;
    }

    setEnviandoGaleria(true);
    try {
      // Comprime cada imagem escolhida e guarda na prévia (ainda não envia)
      const processadas = [];
      for (const asset of resultado.assets) {
        const manipulada = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 800 } }],
          {
            compress: 0.5,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );
        processadas.push({ uri: manipulada.uri, base64: manipulada.base64 });
      }
      setImagensPendentes((prev) => [...prev, ...processadas]);
    } catch (err) {
      console.error("Erro ao processar imagens da galeria:", err);
      setErro("Não foi possível processar uma ou mais imagens.");
    } finally {
      setEnviandoGaleria(false);
    }
  };

  // Remove uma imagem da prévia antes de confirmar o envio
  const removerImagemPendente = (index) =>
    setImagensPendentes((prev) => prev.filter((_, i) => i !== index));

  const cancelarEnvioGaleria = () => {
    setImagensPendentes([]);
    setCategoriaSelecionada(CATEGORIAS_GALERIA[0]);
  };

  // Só aqui, ao confirmar, as imagens são de fato salvas no Firestore,
  // já com a categoria escolhida (usada pelo filtro na Galeria do cliente).
  const confirmarEnvioGaleria = async () => {
    if (imagensPendentes.length === 0) return;

    setErro(null);
    setEnviandoGaleria(true);
    try {
      for (const img of imagensPendentes) {
        await addDoc(collection(db, GALERIA_COLLECTION), {
          imagem: `data:image/jpeg;base64,${img.base64}`,
          categoria: categoriaSelecionada,
          criadoEm: serverTimestamp(),
        });
      }
      setImagensPendentes([]);
    } catch (err) {
      console.error("Erro ao enviar imagens da galeria:", err);
      setErro("Não foi possível enviar uma ou mais imagens. Tente novamente.");
    } finally {
      setEnviandoGaleria(false);
    }
  };

  // Só o admin acessa esta tela e esta função — é a única forma de excluir
  // imagens da galeria; a Home e a tela de Galeria do cliente não têm esse botão.
  const removerImagem = async (id) => {
    try {
      await deleteDoc(doc(db, GALERIA_COLLECTION, id));
    } catch (err) {
      console.error("Erro ao remover imagem da galeria:", err);
      setErro("Não foi possível remover a imagem.");
    }
  };

  // Monta o link do WhatsApp (wa.me) já com uma mensagem preenchida usando os
  // próprios dados que o cliente informou na tela de Agendamento.
  const montarLinkWhatsapp = (agendamento) => {
    const numeroLimpo = (agendamento.whatsapp || "").replace(/\D/g, "");
    if (!numeroLimpo) return null;

    // Garante o código do Brasil (55) na frente do número, sem duplicar
    // caso o cliente já tenha digitado com o DDI.
    const numeroComDDI = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;

    const dataAgendamento =
      agendamento.dataTexto || `${agendamento.dia}/${agendamento.mes}/${agendamento.ano}`;

    const linhas = [
      "Olá! Aqui é do AV Tattoo.",
      `Sobre seu agendamento em ${dataAgendamento} às ${agendamento.horario}.`,
    ];

    const tatuador = agendamento.tatuadorApelido || agendamento.tatuadorNome;
    if (tatuador) linhas.push(`Tatuador: ${tatuador}`);
    if (agendamento.descricao) linhas.push(`Descrição enviada: ${agendamento.descricao}`);

    return `https://wa.me/${numeroComDDI}?text=${encodeURIComponent(linhas.join("\n"))}`;
  };

  // Abre o WhatsApp (app ou web) direto na conversa com o cliente daquele agendamento.
  const abrirWhatsapp = async (agendamento) => {
    const link = montarLinkWhatsapp(agendamento);
    if (!link) {
      setErro("Este agendamento não tem um número de WhatsApp válido.");
      return;
    }
    try {
      await Linking.openURL(link);
    } catch (err) {
      console.error("Erro ao abrir WhatsApp:", err);
      setErro("Não foi possível abrir o WhatsApp.");
    }
  };

  // Exclui um pedido de agendamento (ex: já foi atendido ou foi cancelado pelo cliente)
  const removerAgendamento = async (id) => {
    try {
      await deleteDoc(doc(db, AGENDAMENTOS_COLLECTION, id));
    } catch (err) {
      console.error("Erro ao remover agendamento:", err);
      setErro("Não foi possível remover o agendamento.");
    }
  };

  // Lista de avaliações que será realmente renderizada: reduzida por padrão,
  // completa quando o admin clicar em "Ver todas as avaliações".
  const avaliacoesVisiveis = mostrarTodasAvaliacoes
    ? avaliacoes
    : avaliacoes.slice(0, LIMITE_AVALIACOES_VISIVEIS);

  // Mesma lógica de "ver mais" para a lista de agendamentos.
  const agendamentosVisiveis = mostrarTodosAgendamentos
    ? agendamentos
    : agendamentos.slice(0, LIMITE_AGENDAMENTOS_VISIVEIS);

  // Mesma lógica de "ver mais" para a galeria de imagens enviadas.
  const galeriaVisivel = mostrarTodaGaleria
    ? galeria
    : galeria.slice(0, LIMITE_GALERIA_VISIVEIS);

  // Quantidade de agendamentos recebidos no mês/ano atual, para o card de estatística.
  const hoje = new Date();
  const agendamentosDoMes = agendamentos.filter(
    (a) => a.mes === hoje.getMonth() + 1 && a.ano === hoje.getFullYear()
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.root}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <View style={styles.brandRow}>
            <Image
              source={require("./assets/logoLOGIN.jpeg")}
              style={styles.brandLogo}
              resizeMode="cover"
            />
            <View>
              <Text style={styles.brandText}>AV TATTOO</Text>
              <Text style={styles.brandSubtext}>Estúdio de Tatuagem</Text>
            </View>
          </View>

          <View style={styles.sidebarFooter}>
            <TouchableOpacity
              onPress={() => navigation && navigation.replace("Login")}
              style={styles.sairBtn}
            >
              <Text style={styles.sairText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Conteúdo principal */}
        <View style={styles.main}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.titulo}>Painel Administrativo</Text>
              <Text style={styles.subtitulo}>Bem-vindo, Admin</Text>
            </View>
            <View style={styles.perfilRow}>
            </View>
          </View>

          {erro ? (
            <View style={styles.erroBox}>
              <Text style={styles.erroTexto}>{erro}</Text>
            </View>
          ) : null}

          {/* Stat cards */}
          <View style={styles.statsRow}>
            <StatCard value={tatuadores.length} label="Tatuadores Cadastrados" />
            <StatCard value={galeria.length} label="Imagens na Galeria" />
            <StatCard value={agendamentosDoMes.length} label="Agendamentos (Mês)" />
          </View>

          {/* Agendamentos de Clientes */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Agendamentos de Clientes</Text>
            <Text style={styles.cardDescricao}>
              Pedidos de horário confirmados pelos clientes na tela de Agendamento.
            </Text>

            {carregandoAgendamentos ? (
              <ActivityIndicator color={palette.gold} style={{ marginVertical: 12 }} />
            ) : agendamentos.length === 0 ? (
              <Text style={styles.tatuadorInfo}>Nenhum agendamento recebido ainda.</Text>
            ) : (
              <>
                {agendamentosVisiveis.map((a, index) => (
                  <View key={a.id} style={styles.linhaAgendamento}>
                    <View style={styles.prioridadeBadge}>
                      <Text style={styles.prioridadeBadgeTexto}>{index + 1}º</Text>
                    </View>

                    {a.imagemReferencia ? (
                      <TouchableOpacity onPress={() => setImagemAmpliada(a.imagemReferencia)}>
                        <Image source={{ uri: a.imagemReferencia }} style={styles.agendamentoFoto} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.agendamentoFoto, styles.agendamentoFotoVazia]}>
                        <Text style={styles.agendamentoFotoVaziaTexto}>Sem{"\n"}imagem</Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <View style={styles.avaliacaoTopoAdm}>
                        <Text style={styles.tatuadorNome}>
                          {a.dataTexto || `${a.dia}/${a.mes}/${a.ano}`} • {a.horario}
                        </Text>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeTexto}>{a.status || "pendente"}</Text>
                        </View>
                      </View>

                      <Text style={styles.tatuadorInfo}>
                        Tatuador: {a.tatuadorApelido || a.tatuadorNome || "-"}
                      </Text>
                      <TouchableOpacity onPress={() => abrirWhatsapp(a)}>
                        <Text style={[styles.tatuadorInfo, styles.whatsappLink]}>
                          WhatsApp: {a.whatsapp}
                        </Text>
                      </TouchableOpacity>
                      {!!a.descricao && (
                        <Text style={styles.comentarioAvaliacaoAdm}>{a.descricao}</Text>
                      )}
                    </View>

                    <TouchableOpacity onPress={() => removerAgendamento(a.id)}>
                      <Text style={styles.acaoExcluir}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {agendamentos.length > LIMITE_AGENDAMENTOS_VISIVEIS && (
                  <TouchableOpacity
                    style={styles.verTodosBtn}
                    onPress={() => setMostrarTodosAgendamentos((prev) => !prev)}
                  >
                    <Text style={styles.verTodosTexto}>
                      {mostrarTodosAgendamentos
                        ? "Mostrar menos ↑"
                        : `Ver todos os agendamentos (${agendamentos.length}) →`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Prévia ampliada da imagem de referência de um agendamento */}
            {imagemAmpliada ? (
              <TouchableOpacity
                style={styles.imagemAmpliadaOverlay}
                activeOpacity={1}
                onPress={() => setImagemAmpliada(null)}
              >
                <Image source={{ uri: imagemAmpliada }} style={styles.imagemAmpliada} />
                <Text style={styles.imagemAmpliadaDica}>Toque para fechar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Cadastro de Tatuadores */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Cadastro de Tatuadores</Text>

            {/* Foto do tatuador */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.label}>Foto do Tatuador</Text>
              <View style={styles.fotoPickerRow}>
                <View style={styles.fotoPreviewBox}>
                  {fotoSelecionada ? (
                    <Image
                      source={{ uri: fotoSelecionada.uri }}
                      style={styles.fotoPreviewImagem}
                    />
                  ) : (
                    <Text style={styles.fotoPreviewPlaceholder}>Sem foto</Text>
                  )}
                </View>

                <View style={{ flex: 1, gap: 8 }}>
                  <TouchableOpacity
                    style={styles.btnEscolherFoto}
                    onPress={escolherImagem}
                    disabled={enviandoFoto || salvando}
                  >
                    <Text style={styles.btnEscolherFotoTexto}>
                      {enviandoFoto
                        ? "Processando..."
                        : fotoSelecionada
                        ? "Trocar Imagem"
                        : "Escolher Imagem"}
                    </Text>
                  </TouchableOpacity>

                  {fotoSelecionada ? (
                    <TouchableOpacity onPress={removerFotoSelecionada}>
                      <Text style={styles.removerFotoTexto}>Remover foto selecionada</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <Text style={styles.dicaTexto}>
                Selecione uma imagem do seu aparelho ou computador (PNG ou JPG).
              </Text>
            </View>

            <View style={styles.linhaDupla}>
              <View style={styles.campoMetade}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: João da Silva"
                  placeholderTextColor={palette.textMuted}
                  value={form.nome}
                  onChangeText={handleChange("nome")}
                />
              </View>
              <View style={styles.campoMetade}>
                <Text style={styles.label}>Apelido / Nome Artístico</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: João Tattoo"
                  placeholderTextColor={palette.textMuted}
                  value={form.apelido}
                  onChangeText={handleChange("apelido")}
                />
              </View>
            </View>

            <View style={styles.linhaDupla}>
              <View style={styles.campoMetade}>
                <Text style={styles.label}>Especialidade</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Realismo, Fineline"
                  placeholderTextColor={palette.textMuted}
                  value={form.especialidade}
                  onChangeText={handleChange("especialidade")}
                />
              </View>
              <View style={styles.campoMetade}>
                <Text style={styles.label}>Instagram</Text>
                <TextInput
                  style={styles.input}
                  placeholder="@joaotattoo"
                  placeholderTextColor={palette.textMuted}
                  value={form.instagram}
                  onChangeText={handleChange("instagram")}
                />
              </View>
            </View>

            <View style={{ marginBottom: 14 }}>
              <Text style={styles.label}>Descrição / Biografia</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Fale um pouco sobre o tatuador..."
                placeholderTextColor={palette.textMuted}
                value={form.bio}
                onChangeText={handleChange("bio")}
                multiline
                numberOfLines={4}
              />
            </View>
            <View style={styles.botoesRow}>
              <TouchableOpacity style={styles.btnCancelar} onPress={handleCancelar}>
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnCadastrar, salvando && { opacity: 0.6 }]}
                onPress={handleCadastrar}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnCadastrarTexto}>Cadastrar Tatuador</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Lista de tatuadores */}
            <View style={{ marginTop: 22 }}>
              <Text style={styles.subTituloLista}>Tatuadores Cadastrados</Text>

              {carregando ? (
                <ActivityIndicator color={palette.gold} style={{ marginVertical: 12 }} />
              ) : tatuadores.length === 0 ? (
                <Text style={styles.tatuadorInfo}>Nenhum tatuador cadastrado ainda.</Text>
              ) : (
                tatuadores.map((t) => {
                  const resultado = calcularMedia(t.id);
                  return (
                    <View key={t.id} style={styles.linhaTatuador}>
                      <Image source={{ uri: t.foto }} style={styles.tatuadorFoto} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tatuadorNome}>{t.nome}</Text>
                        <Text style={styles.tatuadorInfo}>{t.especialidade}</Text>
                        <Text style={styles.tatuadorInfo}>{t.instagram}</Text>
                        {resultado ? (
                          <Text style={styles.avaliacaoResumo}>
                            ★ {resultado.media} ({resultado.quantidade})
                          </Text>
                        ) : (
                          <Text style={styles.semAvaliacaoResumo}>Sem avaliações</Text>
                        )}
                      </View>
                      <View style={styles.acoesRow}>
                        <TouchableOpacity>
                          <Text style={styles.acaoEditar}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removerTatuador(t.id)}>
                          <Text style={styles.acaoExcluir}>Excluir</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}

              <TouchableOpacity style={styles.verTodosBtn}>
                <Text style={styles.verTodosTexto}>Ver todos os tatuadores →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Envio de imagens */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Envio de Imagens - Galeria</Text>
            <Text style={styles.cardDescricao}>
              As imagens enviadas serão exibidas na galeria da tela de clientes.
            </Text>

            {/* Categoria que será aplicada às imagens selecionadas abaixo.
                Precisa bater com as abas de filtro da tela Galeria do cliente. */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.label}>Categoria</Text>
              <View style={styles.categoriasRow}>
                {CATEGORIAS_GALERIA.map((cat) => {
                  const ativa = categoriaSelecionada === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategoriaSelecionada(cat)}
                      style={[styles.categoriaChip, ativa && styles.categoriaChipAtiva]}
                    >
                      <Text
                        style={[
                          styles.categoriaChipTexto,
                          ativa && styles.categoriaChipTextoAtiva,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={styles.dropAreaGrande}
              onPress={escolherImagensGaleria}
              disabled={enviandoGaleria}
            >
              {enviandoGaleria && imagensPendentes.length === 0 ? (
                <ActivityIndicator color={palette.gold} />
              ) : (
                <>
                  <Text style={styles.dropTexto}>Toque para selecionar as imagens</Text>
                  <Text style={styles.dropSub}>PNG ou JPG (redimensionadas automaticamente)</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.dicaTexto}>
              Você pode selecionar várias imagens de uma vez. Elas só são enviadas depois que
              você confirmar abaixo.
            </Text>

            {/* Prévia das imagens escolhidas, aguardando confirmação */}
            {imagensPendentes.length > 0 ? (
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.subTituloLista}>
                  Prévia — categoria "{categoriaSelecionada}"
                </Text>
                <View style={styles.galeriaGrid}>
                  {imagensPendentes.map((img, idx) => (
                    <View key={idx} style={styles.galeriaItem}>
                      <Image source={{ uri: img.uri }} style={styles.galeriaImagem} />
                      <TouchableOpacity
                        style={styles.removerImagemBtn}
                        onPress={() => removerImagemPendente(idx)}
                        disabled={enviandoGaleria}
                      >
                        <Text style={styles.removerImagemTexto}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={styles.botoesRow}>
                  <TouchableOpacity
                    style={styles.btnCancelar}
                    onPress={cancelarEnvioGaleria}
                    disabled={enviandoGaleria}
                  >
                    <Text style={styles.btnCancelarTexto}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnCadastrar, enviandoGaleria && { opacity: 0.6 }]}
                    onPress={confirmarEnvioGaleria}
                    disabled={enviandoGaleria}
                  >
                    {enviandoGaleria ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnCadastrarTexto}>
                        Confirmar Envio ({imagensPendentes.length})
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <Text style={styles.subTituloLista}>Imagens Enviadas</Text>
            {carregandoGaleria ? (
              <ActivityIndicator color={palette.gold} style={{ marginVertical: 12 }} />
            ) : galeria.length === 0 ? (
              <Text style={styles.tatuadorInfo}>Nenhuma imagem enviada ainda.</Text>
            ) : (
              <>
                <View style={styles.galeriaGrid}>
                  {galeriaVisivel.map((item) => (
                    <View key={item.id} style={styles.galeriaItem}>
                      <Image source={{ uri: item.imagem }} style={styles.galeriaImagem} />
                      {item.categoria ? (
                        <View style={styles.categoriaBadge}>
                          <Text style={styles.categoriaBadgeTexto} numberOfLines={1}>
                            {item.categoria}
                          </Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={styles.removerImagemBtn}
                        onPress={() => removerImagem(item.id)}
                      >
                        <Text style={styles.removerImagemTexto}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {galeria.length > LIMITE_GALERIA_VISIVEIS && (
                  <TouchableOpacity
                    style={styles.verTodosBtn}
                    onPress={() => setMostrarTodaGaleria((prev) => !prev)}
                  >
                    <Text style={styles.verTodosTexto}>
                      {mostrarTodaGaleria
                        ? "Mostrar menos ↑"
                        : `Ver todas as imagens (${galeria.length}) →`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Gerenciar Avaliações */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Avaliações de Clientes</Text>
            <Text style={styles.cardDescricao}>
              Exclua avaliações de tatuadores que já saíram do estúdio ou comentários inadequados.
            </Text>

            {carregandoAvaliacoes ? (
              <ActivityIndicator color={palette.gold} style={{ marginVertical: 12 }} />
            ) : avaliacoes.length === 0 ? (
              <Text style={styles.tatuadorInfo}>Nenhuma avaliação recebida ainda.</Text>
            ) : (
              <>
                {avaliacoesVisiveis.map((a) => (
                  <View key={a.id} style={styles.linhaAvaliacao}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.avaliacaoTopoAdm}>
                        <Text style={styles.tatuadorNome}>{a.nomeCliente}</Text>
                        <Text style={styles.notaAvaliacaoAdm}>★ {a.nota}</Text>
                      </View>
                      {!!a.tatuadorNome && (
                        <Text style={styles.tatuadorInfo}>Avaliou: {a.tatuadorNome}</Text>
                      )}
                      {!!a.comentario && (
                        <Text style={styles.comentarioAvaliacaoAdm}>{a.comentario}</Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => removerAvaliacao(a.id)}>
                      <Text style={styles.acaoExcluir}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {avaliacoes.length > LIMITE_AVALIACOES_VISIVEIS && (
                  <TouchableOpacity
                    style={styles.verTodosBtn}
                    onPress={() => setMostrarTodasAvaliacoes((prev) => !prev)}
                  >
                    <Text style={styles.verTodosTexto}>
                      {mostrarTodasAvaliacoes
                        ? "Mostrar menos ↑"
                        : `Ver todas as avaliações (${avaliacoes.length}) →`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <Text style={styles.rodape}>
            © 2025 Ink Studio - Todos os direitos reservados.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
    ...(Platform.OS === "web"
      ? {
          height: "100vh",
          maxHeight: "100vh",
          overflowY: "auto",
        }
      : {}),
  },

  scrollContent: {
    flexGrow: 1,
  },

  root: {
    flex: 1,
  },

  sidebar: {
    backgroundColor: palette.panel,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  brandLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.maroonLight,
  },

  brandText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 2,
    color: palette.textPrimary,
    textTransform: "uppercase",
  },

  brandSubtext: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.goldSoft,
    marginTop: 2,
  },

  sidebarFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },

  sairBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },

  sairText: {
    fontSize: 14,
    color: palette.danger,
  },

  main: {
    flex: 1,
    padding: 20,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 10,
  },

  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.textPrimary,
  },

  subtitulo: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: 14,
  },

  perfilRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  perfilFoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  erroBox: {
    backgroundColor: "#3A1E20",
    borderWidth: 1,
    borderColor: palette.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },

  erroTexto: {
    color: palette.danger,
    fontSize: 13,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  statCard: {
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minWidth: 140,
    flexGrow: 1,
  },

  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.textPrimary,
  },

  statLabel: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 2,
  },

  card: {
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },

  cardTitulo: {
    fontSize: 17,
    fontWeight: "600",
    color: palette.textPrimary,
    marginBottom: 16,
  },

  cardDescricao: {
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: 16,
  },

  linhaDupla: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
    flexWrap: "wrap",
  },

  campoMetade: {
    flexGrow: 1,
    flexBasis: "45%",
  },

  label: {
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: 6,
  },

  input: {
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.textPrimary,
    fontSize: 14,
  },

  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  fotoPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  fotoPreviewBox: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  fotoPreviewImagem: {
    width: "100%",
    height: "100%",
  },

  fotoPreviewPlaceholder: {
    fontSize: 11,
    color: palette.textMuted,
    textAlign: "center",
  },

  btnEscolherFoto: {
    alignSelf: "flex-start",
    backgroundColor: palette.maroon,
    borderWidth: 1,
    borderColor: palette.maroonLight,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },

  btnEscolherFotoTexto: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  removerFotoTexto: {
    color: palette.danger,
    fontSize: 12,
  },

  dropArea: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.border,
    borderRadius: 8,
    paddingVertical: 26,
    paddingHorizontal: 12,
    alignItems: "center",
  },

  dropAreaGrande: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.border,
    borderRadius: 8,
    paddingVertical: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    marginBottom: 8,
  },

  dropTexto: {
    fontSize: 14,
    color: palette.textSecondary,
  },

  dropSub: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },

  dicaTexto: {
    fontSize: 12,
    color: palette.textMuted,
    marginBottom: 18,
  },

  botoesRow: {
    flexDirection: "row",
    gap: 10,
  },

  btnCancelar: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
  },

  btnCancelarTexto: {
    color: palette.textSecondary,
    fontSize: 14,
  },

  btnCadastrar: {
    flex: 1,
    backgroundColor: palette.maroon,
    borderWidth: 1,
    borderColor: palette.maroonLight,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  btnCadastrarTexto: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  subTituloLista: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.textSecondary,
    marginBottom: 10,
  },

  linhaTatuador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },

  tatuadorFoto: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  tatuadorNome: {
    fontSize: 14,
    color: palette.textPrimary,
    fontWeight: "600",
  },

  tatuadorInfo: {
    fontSize: 12,
    color: palette.textSecondary,
  },

  whatsappLink: {
    color: "#3DDC84",
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  avaliacaoResumo: {
    fontSize: 12,
    color: palette.gold,
    fontWeight: "600",
    marginTop: 2,
  },

  semAvaliacaoResumo: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },

  acoesRow: {
    flexDirection: "row",
    gap: 12,
  },

  acaoEditar: {
    color: palette.gold,
    fontSize: 12,
  },

  acaoExcluir: {
    color: palette.danger,
    fontSize: 12,
  },

  linhaAvaliacao: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },

  avaliacaoTopoAdm: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
    gap: 8,
  },

  notaAvaliacaoAdm: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "600",
  },

  comentarioAvaliacaoAdm: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },

  verTodosBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },

  verTodosTexto: {
    color: palette.textPrimary,
    fontSize: 13,
  },

  galeriaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },

  galeriaItem: {
    width: "18%",
    minWidth: 70,
    aspectRatio: 1,
    position: "relative",
  },

  galeriaImagem: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },

  removerImagemBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.danger,
    alignItems: "center",
    justifyContent: "center",
  },

  removerImagemTexto: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 14,
  },

  categoriasRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  categoriaChip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: palette.bg,
  },

  categoriaChipAtiva: {
    backgroundColor: palette.maroon,
    borderColor: palette.maroonLight,
  },

  categoriaChipTexto: {
    color: palette.textSecondary,
    fontSize: 12,
  },

  categoriaChipTextoAtiva: {
    color: "#fff",
    fontWeight: "600",
  },

  categoriaBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    right: 26,
    backgroundColor: "rgba(5, 6, 10, 0.75)",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },

  categoriaBadgeTexto: {
    color: "#F5F6F8",
    fontSize: 9,
  },

  // Linha de cada agendamento de cliente
  linhaAgendamento: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },

  prioridadeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  prioridadeBadgeTexto: {
    color: palette.gold,
    fontSize: 10,
    fontWeight: "700",
  },

  agendamentoFoto: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },

  agendamentoFotoVazia: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bg,
  },

  agendamentoFotoVaziaTexto: {
    color: palette.textMuted,
    fontSize: 8,
    textAlign: "center",
  },

  statusBadge: {
    backgroundColor: palette.maroon,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },

  statusBadgeTexto: {
    color: palette.gold,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // Overlay simples para ampliar a imagem de referência de um agendamento
  imagemAmpliadaOverlay: {
    position: Platform.OS === "web" ? "fixed" : "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5, 6, 10, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 999,
  },

  imagemAmpliada: {
    width: "100%",
    maxWidth: 420,
    height: 320,
    borderRadius: 10,
  },

  imagemAmpliadaDica: {
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 12,
  },

  rodape: {
    textAlign: "center",
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 20,
  },
});