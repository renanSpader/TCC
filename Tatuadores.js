import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal } from 'react-native';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

// Ajuste este caminho conforme a localização real do seu firebaseConfig.js
import { db } from './firebaseConfig';

export default function Tatuadores({ navigation }) {

    const [tatuadores, setTatuadores] = useState([]);
    const [carregando, setCarregando] = useState(true);

    // Avaliações de todos os tatuadores, usadas para calcular a média de cada um
    // e para exibir a lista individual dentro do modal quando o usuário toca na nota.
    const [avaliacoes, setAvaliacoes] = useState([]);

    // Controla o modal de avaliações: guarda o tatuador selecionado (ou null se fechado)
    const [tatuadorSelecionado, setTatuadorSelecionado] = useState(null);

    // Escuta a mesma coleção "tatuadores" usada na TelaADM, em tempo real.
    useEffect(() => {
        const q = query(collection(db, 'tatuadores'), orderBy('criadoEm', 'desc'));

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
                console.error('Erro ao carregar tatuadores:', err);
                setCarregando(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Escuta a coleção "avaliacoes" (a mesma criada pela tela Avaliacoes.js)
    useEffect(() => {
        const q = query(collection(db, 'avaliacoes'));
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

    // Retorna a lista de avaliações individuais de um tatuador, mais recentes primeiro
    const avaliacoesDoTatuador = (tatuadorId) => {
        return avaliacoes.filter((a) => a.tatuadorId === tatuadorId);
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

            <View style={styles.header}>
                <Text style={styles.titulo}>NOSSOS TATUADORES</Text>
                <View style={styles.tituloUnderline} />
                <Text style={styles.subtitulo}>Conheça a equipe e escolha o seu artista</Text>
            </View>

            <View style={styles.lista}>
                {carregando ? (
                    <ActivityIndicator color="#2F6FED" style={{ marginTop: 20 }} />
                ) : tatuadores.length === 0 ? (
                    <Text style={styles.semDados}>Nenhum tatuador cadastrado no momento.</Text>
                ) : (
                    tatuadores.map((item) => {
                        const resultado = calcularMedia(item.id);
                        return (
                            <View key={item.id} style={styles.card}>
                                <View style={styles.linhaTopo}>
                                    {item.foto ? (
                                        <Image source={{ uri: item.foto }} style={styles.foto} />
                                    ) : (
                                        <View style={styles.foto} />
                                    )}
                                    <View style={styles.infoTopo}>
                                        <Text style={styles.nome} numberOfLines={1}>{item.nome}</Text>
                                        <Text style={styles.especialidade}>{item.especialidade}</Text>
                                        {resultado ? (
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                onPress={() => setTatuadorSelecionado(item)}
                                                style={styles.linhaAvaliacao}
                                            >
                                                <Text style={styles.avaliacao}>
                                                    ★ {resultado.media} ({resultado.quantidade})
                                                </Text>
                                                <Text style={styles.verAvaliacoesLink}>Ver avaliações</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <Text style={styles.semAvaliacao}>Sem avaliações ainda</Text>
                                        )}
                                    </View>
                                </View>

                                {!!item.bio && <Text style={styles.bio}>{item.bio}</Text>}

                                <TouchableOpacity
                                    style={styles.botaoAgendar}
                                    activeOpacity={0.85}
                                    onPress={() => navigation.navigate('Agendamento', { tatuadorId: item.id, tatuadorNome: item.nome })}
                                >
                                    <Text style={styles.textoBotaoAgendar}>AGENDAR COM {item.nome.split(' ')[0].toUpperCase()}</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}
            </View>

            {/* Modal com as avaliações individuais do tatuador selecionado, no estilo BlaBlaCar:
                a nota resumida fica sempre visível no card, e os comentários só aparecem
                quando o usuário pede pra ver, evitando poluir a lista principal. */}
            <Modal
                visible={!!tatuadorSelecionado}
                animationType="slide"
                transparent
                onRequestClose={() => setTatuadorSelecionado(null)}
            >
                <View style={styles.modalFundo}>
                    <View style={styles.modalConteudo}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitulo} numberOfLines={1}>
                                    Avaliações de {tatuadorSelecionado?.nome}
                                </Text>
                                {tatuadorSelecionado && (() => {
                                    const resultado = calcularMedia(tatuadorSelecionado.id);
                                    return resultado ? (
                                        <Text style={styles.modalMedia}>
                                            ★ {resultado.media} · {resultado.quantidade} avaliação{resultado.quantidade > 1 ? 'ões' : ''}
                                        </Text>
                                    ) : null;
                                })()}
                            </View>
                            <TouchableOpacity onPress={() => setTatuadorSelecionado(null)} style={styles.modalFechar}>
                                <Ionicons name="close" size={22} color="#F5F6F8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalLista} showsVerticalScrollIndicator={false}>
                            {tatuadorSelecionado && avaliacoesDoTatuador(tatuadorSelecionado.id).map((av) => (
                                <View key={av.id} style={styles.cardAvaliacaoModal}>
                                    <View style={styles.avaliacaoTopoModal}>
                                        <Text style={styles.nomeClienteModal} numberOfLines={1}>
                                            {av.nomeCliente || 'Cliente'}
                                        </Text>
                                        <Text style={styles.notaClienteModal}>★ {av.nota}</Text>
                                    </View>
                                    {!!av.comentario && (
                                        <Text style={styles.comentarioClienteModal}>{av.comentario}</Text>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

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
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    lista: {
        padding: 20,
    },
    semDados: {
        color: '#8B929E',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 10,
    },
    card: {
        backgroundColor: '#0D0F13',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#20242C',
        padding: 18,
        marginBottom: 18,
        shadowColor: '#2F6FED',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 10,
    },
    linhaTopo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    foto: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#15181E',
        borderWidth: 1.5,
        borderColor: '#2F6FED',
        opacity: 0.9,
        marginRight: 14,
    },
    infoTopo: {
        flex: 1,
    },
    nome: {
        color: '#F5F6F8',
        fontSize: 15,
        fontWeight: '700',
    },
    especialidade: {
        color: '#8B929E',
        fontSize: 12,
        marginTop: 2,
    },
    linhaAvaliacao: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    avaliacao: {
        color: '#2F6FED',
        fontSize: 12,
        fontWeight: '600',
    },
    verAvaliacoesLink: {
        color: '#6B7280',
        fontSize: 11,
        marginLeft: 8,
        textDecorationLine: 'underline',
    },
    semAvaliacao: {
        color: '#6B7280',
        fontSize: 11,
        marginTop: 4,
    },
    bio: {
        color: '#8B929E',
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 16,
    },
    botaoAgendar: {
        backgroundColor: '#1B3A6B',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2F6FED',
        shadowColor: '#2F6FED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    textoBotaoAgendar: {
        color: '#F5F6F8',
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 1.5,
    },

    // Modal de avaliações
    modalFundo: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalConteudo: {
        backgroundColor: '#0D0F13',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: '#20242C',
        maxHeight: '75%',
        paddingTop: 18,
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#20242C',
    },
    modalTitulo: {
        color: '#F5F6F8',
        fontSize: 15,
        fontWeight: '700',
    },
    modalMedia: {
        color: '#2F6FED',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    modalFechar: {
        padding: 4,
        marginLeft: 12,
    },
    modalLista: {
        maxHeight: 420,
    },
    cardAvaliacaoModal: {
        backgroundColor: '#15181E',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#20242C',
        padding: 14,
        marginBottom: 12,
    },
    avaliacaoTopoModal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    nomeClienteModal: {
        color: '#F5F6F8',
        fontSize: 13,
        fontWeight: '700',
        flexShrink: 1,
        marginRight: 8,
    },
    notaClienteModal: {
        color: '#2F6FED',
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 0,
    },
    comentarioClienteModal: {
        color: '#8B929E',
        fontSize: 12,
        lineHeight: 17,
    },
});