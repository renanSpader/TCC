import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

// Ajuste este caminho conforme a localização real do seu firebaseConfig.js
import { db } from './firebaseConfig';

export default function Avaliacoes({ navigation }) {

    // Lista de tatuadores, pra o cliente escolher quem está avaliando
    const [tatuadores, setTatuadores] = useState([]);

    // Avaliações já feitas, vindas do Firestore em tempo real
    const [avaliacoes, setAvaliacoes] = useState([]);
    const [carregando, setCarregando] = useState(true);

    // Campos do formulário de nova avaliação
    const [tatuadorId, setTatuadorId] = useState(null);
    const [tatuadorNome, setTatuadorNome] = useState(null);
    const [nomeCliente, setNomeCliente] = useState('');
    const [nota, setNota] = useState(0);
    const [comentario, setComentario] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState(null);

    // Carrega a lista de tatuadores (mesma coleção usada em Tatuadores.js / TelaAdm.js)
    useEffect(() => {
        const q = query(collection(db, 'tatuadores'), orderBy('criadoEm', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            setTatuadores(lista);
        });
        return () => unsubscribe();
    }, []);

    // Escuta as avaliações em tempo real
    useEffect(() => {
        const q = query(collection(db, 'avaliacoes'), orderBy('criadoEm', 'desc'));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const lista = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
                setAvaliacoes(lista);
                setCarregando(false);
            },
            (err) => {
                console.error('Erro ao carregar avaliações:', err);
                setCarregando(false);
            }
        );
        return () => unsubscribe();
    }, []);

    // Calcula a média geral das notas (protegido contra lista vazia, que daria NaN)
    const media = avaliacoes.length
        ? (avaliacoes.reduce((soma, item) => soma + Number(item.nota || 0), 0) / avaliacoes.length).toFixed(1)
        : '0.0';

    const selecionarTatuador = (t) => {
        setTatuadorId(t.id);
        setTatuadorNome(t.nome);
    };

    const handleEnviarAvaliacao = async () => {
        if (!tatuadorId) {
            setErro('Escolha qual tatuador você está avaliando.');
            return;
        }
        if (nota === 0) {
            setErro('Toque nas estrelas para dar uma nota.');
            return;
        }
        if (!nomeCliente.trim()) {
            setErro('Digite seu nome.');
            return;
        }

        setEnviando(true);
        setErro(null);
        try {
            await addDoc(collection(db, 'avaliacoes'), {
                tatuadorId,
                tatuadorNome,
                nomeCliente: nomeCliente.trim(),
                nota,
                comentario: comentario.trim(),
                criadoEm: serverTimestamp(),
            });

            // Limpa o formulário depois de enviar
            setTatuadorId(null);
            setTatuadorNome(null);
            setNomeCliente('');
            setNota(0);
            setComentario('');
        } catch (err) {
            console.error('Erro ao enviar avaliação:', err);
            setErro('Não foi possível enviar sua avaliação. Tente novamente.');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

            <View style={styles.header}>
                <Text style={styles.titulo}>AVALIAÇÕES DE CLIENTES</Text>
                <View style={styles.tituloUnderline} />
                <Text style={styles.subtitulo}>Veja o que quem já tatuou com a gente está dizendo</Text>

                <View style={styles.mediaBox}>
                    <Text style={styles.mediaNota}>★ {media}</Text>
                    <Text style={styles.mediaTexto}>{avaliacoes.length} avaliações</Text>
                </View>
            </View>

            {/* Formulário para o cliente deixar sua avaliação */}
            <View style={styles.formCard}>
                <Text style={styles.formTitulo}>Deixe sua avaliação</Text>

                <Text style={styles.label}>Qual tatuador você quer avaliar?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    {tatuadores.length === 0 ? (
                        <Text style={styles.semDados}>Nenhum tatuador cadastrado ainda.</Text>
                    ) : (
                        tatuadores.map((t) => {
                            const ativo = tatuadorId === t.id;
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[styles.chip, ativo && styles.chipAtivo]}
                                    onPress={() => selecionarTatuador(t)}
                                >
                                    <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]} numberOfLines={1}>
                                        {t.nome}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>

                <Text style={styles.label}>Sua nota</Text>
                <View style={styles.estrelasRow}>
                    {[1, 2, 3, 4, 5].map((valor) => (
                        <TouchableOpacity key={valor} onPress={() => setNota(valor)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                            <Ionicons
                                name={valor <= nota ? 'star' : 'star-outline'}
                                size={30}
                                color="#2F6FED"
                                style={{ marginRight: 6 }}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Seu nome</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ex: Maria Souza"
                    placeholderTextColor="#6B7280"
                    value={nomeCliente}
                    onChangeText={setNomeCliente}
                />

                <Text style={styles.label}>Comentário (opcional)</Text>
                <TextInput
                    style={[styles.input, styles.textarea]}
                    placeholder="Conte como foi sua experiência..."
                    placeholderTextColor="#6B7280"
                    value={comentario}
                    onChangeText={setComentario}
                    multiline
                    numberOfLines={3}
                />

                {erro ? <Text style={styles.erroTexto}>{erro}</Text> : null}

                <TouchableOpacity
                    style={[styles.botaoEnviar, enviando && { opacity: 0.6 }]}
                    onPress={handleEnviarAvaliacao}
                    disabled={enviando}
                >
                    {enviando ? (
                        <ActivityIndicator color="#F5F6F8" />
                    ) : (
                        <Text style={styles.textoBotaoEnviar}>ENVIAR AVALIAÇÃO</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.lista}>
                {carregando ? (
                    <ActivityIndicator color="#2F6FED" style={{ marginTop: 10 }} />
                ) : avaliacoes.length === 0 ? (
                    <Text style={styles.semDados}>Ainda não há avaliações. Seja o primeiro a avaliar!</Text>
                ) : (
                    avaliacoes.map((item) => (
                        <View key={item.id} style={styles.card}>
                            <View style={styles.topo}>
                                <Text style={styles.nome} numberOfLines={1}>{item.nomeCliente}</Text>
                                <Text style={styles.nota}>★ {item.nota}</Text>
                            </View>
                            {!!item.tatuadorNome && (
                                <Text style={styles.avaliouTexto}>Avaliou: {item.tatuadorNome}</Text>
                            )}
                            {!!item.comentario && <Text style={styles.comentario}>{item.comentario}</Text>}
                        </View>
                    ))
                )}
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05060A',
    },
    header: {
        paddingTop: 30,
        paddingHorizontal: 20,
        paddingBottom: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#20242C',
    },
    titulo: {
        color: '#F5F6F8',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 4,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    tituloUnderline: {
        width: 42,
        height: 2,
        backgroundColor: '#2F6FED',
        borderRadius: 2,
        marginTop: 10,
        marginBottom: 12,
    },
    subtitulo: {
        color: '#8B929E',
        fontSize: 13,
        marginBottom: 18,
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    mediaBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0D0F13',
        borderWidth: 1,
        borderColor: '#20242C',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        alignSelf: 'center',
        shadowColor: '#2F6FED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6,
    },
    mediaNota: {
        color: '#2F6FED',
        fontSize: 16,
        fontWeight: '700',
        marginRight: 8,
    },
    mediaTexto: {
        color: '#8B929E',
        fontSize: 12,
    },

    // Formulário de nova avaliação
    formCard: {
        margin: 20,
        marginBottom: 0,
        backgroundColor: '#0D0F13',
        borderWidth: 1,
        borderColor: '#20242C',
        borderRadius: 14,
        padding: 18,
    },
    formTitulo: {
        color: '#F5F6F8',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 14,
    },
    label: {
        color: '#8B929E',
        fontSize: 12,
        marginBottom: 8,
    },
    chip: {
        borderWidth: 1,
        borderColor: '#20242C',
        backgroundColor: '#15181E',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginRight: 8,
        maxWidth: 160,
    },
    chipAtivo: {
        backgroundColor: '#1B3A6B',
        borderColor: '#2F6FED',
    },
    chipTexto: {
        color: '#8B929E',
        fontSize: 12,
        fontWeight: '600',
    },
    chipTextoAtivo: {
        color: '#F5F6F8',
    },
    estrelasRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    input: {
        backgroundColor: '#05060A',
        borderWidth: 1,
        borderColor: '#20242C',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#F5F6F8',
        fontSize: 14,
        marginBottom: 16,
    },
    textarea: {
        minHeight: 70,
        textAlignVertical: 'top',
    },
    erroTexto: {
        color: '#E0575A',
        fontSize: 12,
        marginBottom: 12,
    },
    botaoEnviar: {
        backgroundColor: '#1B3A6B',
        borderWidth: 1,
        borderColor: '#2F6FED',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textoBotaoEnviar: {
        color: '#F5F6F8',
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 1.5,
    },

    lista: {
        padding: 20,
    },
    semDados: {
        color: '#8B929E',
        fontSize: 12,
    },
    card: {
        backgroundColor: '#0D0F13',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#20242C',
        padding: 16,
        marginBottom: 14,
        shadowColor: '#2F6FED',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 6,
    },
    topo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    nome: {
        color: '#F5F6F8',
        fontSize: 13,
        fontWeight: '700',
        flexShrink: 1,
        marginRight: 8,
    },
    nota: {
        color: '#2F6FED',
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 0,
    },
    avaliouTexto: {
        color: '#6B7280',
        fontSize: 11,
        marginBottom: 8,
    },
    comentario: {
        color: '#8B929E',
        fontSize: 12,
        lineHeight: 17,
    },
});