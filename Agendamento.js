import { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

// Ajuste este caminho conforme a localização real do seu firebaseConfig.js
import { db } from './firebaseConfig';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const HORARIOS = ['09:00', '10:30', '13:00', '14:30', '16:00', '17:30'];

// Status de agendamento que NÃO devem bloquear o horário (ex: cliente cancelou).
// Qualquer outro status ("pendente", "confirmado", etc.) é considerado como
// "horário ocupado" para não deixar dois clientes marcarem o mesmo horário.
const STATUS_QUE_LIBERAM_HORARIO = ['cancelado', 'recusado'];

// Mesmo nome de coleção usado na Tela Admin
const TATUADORES_COLLECTION = 'tatuadores';
// Coleção onde os agendamentos feitos pelo cliente são salvos.
// A Tela Admin escuta essa mesma coleção para exibir os pedidos.
const AGENDAMENTOS_COLLECTION = 'agendamentos';

export default function Agendamento({ navigation, route }) {

    // Lista de tatuadores agora vem do Firestore (mesma coleção cadastrada no Painel Admin)
    const [tatuadores, setTatuadores] = useState([]);
    const [carregandoTatuadores, setCarregandoTatuadores] = useState(true);

    const [tatuadorId, setTatuadorId] = useState(route?.params?.tatuadorId ?? null);
    const [mesAtual, setMesAtual] = useState(new Date().getMonth());
    const [anoAtual, setAnoAtual] = useState(new Date().getFullYear());
    const [diaSelecionado, setDiaSelecionado] = useState(new Date().getDate());
    const [horarioSelecionado, setHorarioSelecionado] = useState(null);
    const [descricao, setDescricao] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    // Agora guarda { uri, base64 } (igual ao padrão usado na Tela Admin),
    // para conseguirmos enviar a imagem junto do agendamento ao Firestore.
    const [imagemReferencia, setImagemReferencia] = useState(null);
    const [processandoImagem, setProcessandoImagem] = useState(false);
    const [enviandoAgendamento, setEnviandoAgendamento] = useState(false);
    // Controla a mensagem de sucesso exibida na própria tela após confirmar
    const [sucessoVisivel, setSucessoVisivel] = useState(false);
    const [detalhesSucesso, setDetalhesSucesso] = useState(null);

    // Todos os agendamentos já feitos (de todos os clientes), usados para
    // descobrir quais horários já estão ocupados. Escutamos a mesma coleção
    // que a Tela Admin, em tempo real, para o calendário atualizar sozinho
    // assim que alguém marca ou cancela um horário.
    const [todosAgendamentos, setTodosAgendamentos] = useState([]);
    const [carregandoAgendamentos, setCarregandoAgendamentos] = useState(true);

    // Escuta a coleção "tatuadores" no Firestore em tempo real, igual à Tela Admin,
    // assim qualquer tatuador cadastrado lá aparece aqui automaticamente.
    useEffect(() => {
        const q = query(collection(db, TATUADORES_COLLECTION), orderBy('criadoEm', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const lista = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                }));
                setTatuadores(lista);
                setCarregandoTatuadores(false);

                // Se ainda não há tatuador selecionado (ou o selecionado não existe mais),
                // seleciona o primeiro da lista automaticamente.
                setTatuadorId((atual) => {
                    if (atual && lista.some((t) => t.id === atual)) return atual;
                    return lista[0]?.id ?? null;
                });
            },
            (err) => {
                console.error('Erro ao carregar tatuadores:', err);
                setCarregandoTatuadores(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Escuta a coleção "agendamentos" inteira (mesma coleção que a Tela Admin usa)
    // para sabermos, em tempo real, quais dias/horários já têm gente marcada.
    useEffect(() => {
        const q = query(collection(db, AGENDAMENTOS_COLLECTION), orderBy('criadoEm', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const lista = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                }));
                setTodosAgendamentos(lista);
                setCarregandoAgendamentos(false);
            },
            (err) => {
                console.error('Erro ao carregar agendamentos existentes:', err);
                setCarregandoAgendamentos(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Agendamentos que "contam" como ocupando um horário (ignora cancelados/recusados)
    const agendamentosAtivos = useMemo(
        () => todosAgendamentos.filter((a) => !STATUS_QUE_LIBERAM_HORARIO.includes(a.status)),
        [todosAgendamentos]
    );

    // Conjunto de horários já ocupados para o tatuador + dia atualmente selecionados.
    // É recalculado sempre que o tatuador, o dia, o mês, o ano ou a lista de
    // agendamentos mudarem (por exemplo, outro cliente acabou de marcar).
    const horariosOcupados = useMemo(() => {
        if (!tatuadorId || !diaSelecionado) return new Set();
        const ocupados = agendamentosAtivos
            .filter(
                (a) =>
                    a.tatuadorId === tatuadorId &&
                    a.dia === diaSelecionado &&
                    a.mes === mesAtual + 1 &&
                    a.ano === anoAtual
            )
            .map((a) => a.horario);
        return new Set(ocupados);
    }, [agendamentosAtivos, tatuadorId, diaSelecionado, mesAtual, anoAtual]);

    // Dias do mês em que o tatuador selecionado já não tem NENHUM horário livre,
    // para conseguirmos sinalizar isso no calendário (bolinha/traço no dia).
    const diasLotados = useMemo(() => {
        if (!tatuadorId) return new Set();
        const contagemPorDia = {};
        agendamentosAtivos.forEach((a) => {
            if (a.tatuadorId !== tatuadorId || a.mes !== mesAtual + 1 || a.ano !== anoAtual) return;
            contagemPorDia[a.dia] = (contagemPorDia[a.dia] || 0) + 1;
        });
        const lotados = Object.keys(contagemPorDia)
            .filter((dia) => contagemPorDia[dia] >= HORARIOS.length)
            .map(Number);
        return new Set(lotados);
    }, [agendamentosAtivos, tatuadorId, mesAtual, anoAtual]);

    // Se o horário escolhido pelo cliente ficar ocupado (por exemplo, outra pessoa
    // confirmou um instante antes) ou se o cliente trocar de tatuador/dia, limpamos
    // a seleção para evitar enviar um horário que não está mais disponível.
    useEffect(() => {
        if (horarioSelecionado && horariosOcupados.has(horarioSelecionado)) {
            setHorarioSelecionado(null);
        }
    }, [horariosOcupados, horarioSelecionado]);

    // Monta a grade do calendário do mês atual (com espaços vazios antes do dia 1)
    const diasDoMes = useMemo(() => {
        const primeiroDiaSemana = new Date(anoAtual, mesAtual, 1).getDay();
        const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();

        const dias = [];
        for (let i = 0; i < primeiroDiaSemana; i++) {
            dias.push(null);
        }
        for (let d = 1; d <= totalDias; d++) {
            dias.push(d);
        }
        return dias;
    }, [mesAtual, anoAtual]);

    function mudarMes(delta) {
        let novoMes = mesAtual + delta;
        let novoAno = anoAtual;
        if (novoMes < 0) {
            novoMes = 11;
            novoAno -= 1;
        } else if (novoMes > 11) {
            novoMes = 0;
            novoAno += 1;
        }
        setMesAtual(novoMes);
        setAnoAtual(novoAno);
        setDiaSelecionado(null);
        setHorarioSelecionado(null);
    }

    function selecionarDia(dia) {
        setDiaSelecionado(dia);
        setHorarioSelecionado(null);
    }

    function selecionarTatuador(id) {
        setTatuadorId(id);
        setHorarioSelecionado(null);
    }

    // Abre a galeria do dispositivo para escolher uma imagem de referência.
    // A imagem é redimensionada/comprimida (igual à Tela Admin) para poder
    // ser enviada junto do agendamento como texto (base64) no Firestore.
    async function escolherImagem() {
        const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissao.granted) {
            Alert.alert(
                'Permissão necessária',
                'Precisamos de acesso às suas fotos para adicionar uma imagem de referência.'
            );
            return;
        }

        const resultado = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!resultado.canceled && resultado.assets?.length > 0) {
            try {
                setProcessandoImagem(true);
                const manipulada = await ImageManipulator.manipulateAsync(
                    resultado.assets[0].uri,
                    [{ resize: { width: 600 } }],
                    {
                        compress: 0.5,
                        format: ImageManipulator.SaveFormat.JPEG,
                        base64: true,
                    }
                );
                setImagemReferencia({ uri: manipulada.uri, base64: manipulada.base64 });
            } catch (err) {
                console.error('Erro ao processar imagem:', err);
                Alert.alert('Erro', 'Não foi possível processar a imagem selecionada.');
            } finally {
                setProcessandoImagem(false);
            }
        }
    }

    function removerImagem() {
        setImagemReferencia(null);
    }

    // Formata o número enquanto o usuário digita: (99) 99999-9999
    function formatarWhatsapp(texto) {
        const numeros = texto.replace(/\D/g, '').slice(0, 11);
        let formatado = numeros;
        if (numeros.length > 2) {
            formatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
        }
        if (numeros.length > 7) {
            formatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
        }
        setWhatsapp(formatado);
    }

    async function confirmarAgendamento() {
        if (!tatuadorId) {
            Alert.alert('Faltam informações', 'Escolha um tatuador.');
            return;
        }
        if (!diaSelecionado || !horarioSelecionado) {
            Alert.alert('Faltam informações', 'Escolha uma data e um horário disponível.');
            return;
        }

        // Checagem de segurança: garante que o horário não foi ocupado por
        // outro cliente entre o momento em que a tela carregou e o clique em confirmar.
        if (horariosOcupados.has(horarioSelecionado)) {
            Alert.alert(
                'Horário indisponível',
                'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.'
            );
            setHorarioSelecionado(null);
            return;
        }

        const numerosWhatsapp = whatsapp.replace(/\D/g, '');
        if (numerosWhatsapp.length < 10) {
            Alert.alert('Faltam informações', 'Informe um número de WhatsApp válido.');
            return;
        }

        const tatuador = tatuadores.find((t) => t.id === tatuadorId);

        setEnviandoAgendamento(true);
        try {
            // Salva o agendamento no Firestore. A Tela Admin escuta essa mesma
            // coleção ("agendamentos") em tempo real e exibe os pedidos assim que chegam.
            await addDoc(collection(db, AGENDAMENTOS_COLLECTION), {
                tatuadorId,
                tatuadorNome: tatuador?.nome ?? '',
                tatuadorApelido: tatuador?.apelido ?? '',
                dia: diaSelecionado,
                mes: mesAtual + 1,
                ano: anoAtual,
                dataTexto: `${diaSelecionado}/${mesAtual + 1}/${anoAtual}`,
                horario: horarioSelecionado,
                whatsapp,
                descricao: descricao.trim(),
                imagemReferencia: imagemReferencia
                    ? `data:image/jpeg;base64,${imagemReferencia.base64}`
                    : null,
                status: 'pendente',
                criadoEm: serverTimestamp(),
            });

            // Mostra a mensagem de sucesso direto na tela (em vez de um Alert nativo)
            setDetalhesSucesso({
                tatuador: tatuador?.apelido || tatuador?.nome || '',
                data: `${diaSelecionado}/${mesAtual + 1}/${anoAtual}`,
                horario: horarioSelecionado,
            });
            setSucessoVisivel(true);

            // Limpa o formulário depois de enviar com sucesso
            setDescricao('');
            setWhatsapp('');
            setImagemReferencia(null);
            setHorarioSelecionado(null);

            // Esconde a mensagem sozinha depois de alguns segundos
            setTimeout(() => setSucessoVisivel(false), 5000);
        } catch (err) {
            console.error('Erro ao salvar agendamento:', err);
            Alert.alert('Erro', 'Não foi possível confirmar o agendamento. Tente novamente.');
        } finally {
            setEnviandoAgendamento(false);
        }
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageWrapper}>

            <View style={styles.header}>
                <Text style={styles.titulo}>AGENDAR HORÁRIO</Text>
                <View style={styles.tituloUnderline} />
                <Text style={styles.subtitulo}>Escolha o tatuador, a data e o horário</Text>
            </View>

            {/* Escolha do tatuador */}
            <View style={styles.secao}>
                <Text style={styles.secaoTitulo}>ESCOLHA O TATUADOR</Text>

                {carregandoTatuadores ? (
                    <ActivityIndicator color="#2F6FED" style={{ marginVertical: 12 }} />
                ) : tatuadores.length === 0 ? (
                    <Text style={styles.semTatuadoresTexto}>
                        Nenhum tatuador cadastrado no momento.
                    </Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {tatuadores.map((item) => {
                            const ativo = item.id === tatuadorId;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.tatuadorItem}
                                    onPress={() => selecionarTatuador(item.id)}
                                    activeOpacity={0.85}
                                >
                                    {item.foto ? (
                                        <Image
                                            source={{ uri: item.foto }}
                                            style={[styles.tatuadorFoto, ativo && styles.tatuadorFotoAtiva]}
                                        />
                                    ) : (
                                        <View style={[styles.tatuadorFoto, ativo && styles.tatuadorFotoAtiva]} />
                                    )}
                                    <Text style={[styles.tatuadorNome, ativo && styles.tatuadorNomeAtivo]} numberOfLines={1}>
                                        {item.apelido || item.nome}
                                    </Text>
                                    <Text style={styles.tatuadorEspecialidade} numberOfLines={1}>
                                        {item.especialidade}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            {/* Calendário */}
            <View style={styles.secao}>
                <Text style={styles.secaoTitulo}>ESCOLHA A DATA</Text>

                <View style={styles.calendarioCard}>
                        <View style={styles.calendarioTopo}>
                            <TouchableOpacity onPress={() => mudarMes(-1)} style={styles.setaMes}>
                                <Text style={styles.setaMesTexto}>‹</Text>
                            </TouchableOpacity>

                            <Text style={styles.mesAno}>{MESES[mesAtual]} {anoAtual}</Text>

                            <TouchableOpacity onPress={() => mudarMes(1)} style={styles.setaMes}>
                                <Text style={styles.setaMesTexto}>›</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.diasSemanaLinha}>
                            {DIAS_SEMANA.map((dia, index) => (
                                <Text key={index} style={styles.diaSemanaTexto}>{dia}</Text>
                            ))}
                        </View>

                        <View style={styles.gradeDias}>
                            {diasDoMes.map((dia, index) => {
                                const ativo = dia === diaSelecionado;
                                const lotado = dia !== null && diasLotados.has(dia);
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        disabled={dia === null}
                                        style={[styles.diaCelula, ativo && styles.diaCelulaAtiva]}
                                        onPress={() => selecionarDia(dia)}
                                    >
                                        {dia !== null && (
                                            <>
                                                <Text style={[styles.diaTexto, ativo && styles.diaTextoAtivo, lotado && !ativo && styles.diaTextoLotado]}>
                                                    {dia}
                                                </Text>
                                                {lotado && <View style={styles.diaLotadoPonto} />}
                                            </>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {tatuadorId && (
                            <View style={styles.legendaLinha}>
                                <View style={styles.legendaItem}>
                                    <View style={styles.legendaPontoLotado} />
                                    <Text style={styles.legendaTexto}>Dia sem horários livres para este tatuador</Text>
                                </View>
                            </View>
                        )}
                </View>
            </View>

            {/* Horários disponíveis */}
            <View style={styles.secao}>
                <Text style={styles.secaoTitulo}>HORÁRIOS DISPONÍVEIS</Text>

                {!tatuadorId || !diaSelecionado ? (
                    <Text style={styles.dicaTexto}>Escolha um tatuador e uma data para ver os horários.</Text>
                ) : carregandoAgendamentos ? (
                    <ActivityIndicator color="#2F6FED" style={{ marginVertical: 4 }} />
                ) : (
                    <>
                        <View style={styles.horariosLinha}>
                            {HORARIOS.map((hora) => {
                                const ativo = hora === horarioSelecionado;
                                const ocupado = horariosOcupados.has(hora);
                                return (
                                    <TouchableOpacity
                                        key={hora}
                                        style={[
                                            styles.horarioChip,
                                            ativo && styles.horarioChipAtivo,
                                            ocupado && styles.horarioChipOcupado,
                                        ]}
                                        onPress={() => !ocupado && setHorarioSelecionado(hora)}
                                        activeOpacity={ocupado ? 1 : 0.85}
                                        disabled={ocupado}
                                    >
                                        <Text
                                            style={[
                                                styles.horarioTexto,
                                                ativo && styles.horarioTextoAtivo,
                                                ocupado && styles.horarioTextoOcupado,
                                            ]}
                                        >
                                            {hora}
                                        </Text>
                                        {ocupado && <Text style={styles.horarioOcupadoLabel}>Ocupado</Text>}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {HORARIOS.every((hora) => horariosOcupados.has(hora)) && (
                            <Text style={styles.semHorariosTexto}>
                                Não há mais horários livres para este tatuador nesta data. Tente escolher outro dia.
                            </Text>
                        )}
                    </>
                )}
            </View>

            {/* WhatsApp para contato */}
            <View style={styles.secao}>
                <Text style={styles.secaoTitulo}>SEU WHATSAPP</Text>
                <TextInput
                    style={styles.input}
                    placeholder="(99) 99999-9999"
                    placeholderTextColor="#6B7280"
                    keyboardType="phone-pad"
                    value={whatsapp}
                    onChangeText={formatarWhatsapp}
                    maxLength={16}
                />
                <Text style={styles.dicaTexto}>
                    Usaremos esse número para confirmar seu agendamento.
                </Text>
            </View>

            {/* Descrição da tatuagem desejada */}
            <View style={styles.secao}>
                <Text style={styles.secaoTitulo}>DESCREVA A TATUAGEM DESEJADA</Text>
                <TextInput
                    style={styles.textarea}
                    placeholder="Conte o estilo, tamanho aproximado e local do corpo..."
                    placeholderTextColor="#6B7280"
                    multiline
                    numberOfLines={4}
                    value={descricao}
                    onChangeText={setDescricao}
                />
            </View>

            {/* Imagem de referência (opcional) */}
            <View style={styles.secao}>
                <Text style={styles.secaoTitulo}>IMAGEM DE REFERÊNCIA (OPCIONAL)</Text>

                {processandoImagem ? (
                    <View style={styles.uploadBox}>
                        <ActivityIndicator color="#2F6FED" />
                    </View>
                ) : imagemReferencia ? (
                    <View style={styles.previewBox}>
                        <Image source={{ uri: imagemReferencia.uri }} style={styles.previewImagem} />
                        <View style={styles.previewAcoes}>
                            <TouchableOpacity
                                style={styles.previewBotao}
                                onPress={escolherImagem}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.previewBotaoTexto}>Trocar foto</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.previewBotao, styles.previewBotaoRemover]}
                                onPress={removerImagem}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.previewBotaoTexto}>Remover</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.uploadBox} onPress={escolherImagem} activeOpacity={0.85}>
                        <Text style={styles.uploadTexto}>Clique para adicionar uma foto</Text>
                        <Text style={styles.uploadSubtexto}>Escolha uma imagem da galeria do seu dispositivo</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Confirmação */}
            <View style={[styles.secao, styles.secaoFinal]}>
                <TouchableOpacity
                    style={[styles.botaoConfirmar, enviandoAgendamento && { opacity: 0.7 }]}
                    onPress={confirmarAgendamento}
                    activeOpacity={0.85}
                    disabled={enviandoAgendamento}
                >
                    {enviandoAgendamento ? (
                        <ActivityIndicator color="#F5F6F8" />
                    ) : (
                        <Text style={styles.textoBotaoConfirmar}>CONFIRMAR AGENDAMENTO</Text>
                    )}
                </TouchableOpacity>
            </View>

          </View>

          {/* Mensagem de sucesso exibida na própria tela após confirmar o agendamento */}
          {sucessoVisivel && detalhesSucesso ? (
              <TouchableOpacity
                  style={styles.sucessoOverlay}
                  activeOpacity={1}
                  onPress={() => setSucessoVisivel(false)}
              >
                  <View style={styles.sucessoCard}>
                      <View style={styles.sucessoIconeCirculo}>
                          <Text style={styles.sucessoIconeTexto}>✓</Text>
                      </View>
                      <Text style={styles.sucessoTitulo}>Agendamento confirmado!</Text>
                      <Text style={styles.sucessoDescricao}>
                          {detalhesSucesso.tatuador} • {detalhesSucesso.data} às {detalhesSucesso.horario}
                      </Text>
                      <Text style={styles.sucessoDica}>
                          Em breve entraremos em contato pelo WhatsApp para confirmar.
                      </Text>
                      <TouchableOpacity
                          style={styles.sucessoBotao}
                          onPress={() => setSucessoVisivel(false)}
                          activeOpacity={0.85}
                      >
                          <Text style={styles.sucessoBotaoTexto}>OK</Text>
                      </TouchableOpacity>
                  </View>
              </TouchableOpacity>
          ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05060A',
    },
    // Centraliza o conteúdo horizontalmente quando a ScrollView é mais larga que o pageWrapper (PC)
    scrollContent: {
        alignItems: 'center',
    },
    // Limita a largura de TODA a tela a um tamanho "de celular", mesmo no desktop.
    // No celular isso não tem efeito (a tela já é menor que 480), no PC evita que
    // qualquer seção (calendário, cards, inputs, botão) fique esticada e desproporcional.
    pageWrapper: {
        width: '100%',
        maxWidth: 480,
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
    secao: {
        paddingHorizontal: 20,
        paddingTop: 22,
    },
    secaoFinal: {
        paddingBottom: 40,
    },
    secaoTitulo: {
        color: '#8B929E',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginBottom: 14,
    },

    semTatuadoresTexto: {
        color: '#8B929E',
        fontSize: 13,
    },

    // Seleção de tatuador
    tatuadorItem: {
        width: 90,
        marginRight: 14,
        alignItems: 'center',
    },
    tatuadorFoto: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#15181E',
        borderWidth: 1.5,
        borderColor: '#262A33',
        marginBottom: 8,
    },
    tatuadorFotoAtiva: {
        borderColor: '#2F6FED',
    },
    tatuadorNome: {
        color: '#F5F6F8',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    tatuadorNomeAtivo: {
        color: '#2F6FED',
    },
    tatuadorEspecialidade: {
        color: '#8B929E',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 2,
    },

    // Calendário
    // A largura já é controlada pelo pageWrapper (limita a tela toda a 480px no PC);
    // aqui só garantimos que o card ocupe 100% desse espaço.
    calendarioCard: {
        width: '100%',
        backgroundColor: '#0D0F13',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#20242C',
        padding: 16,
        shadowColor: '#2F6FED',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 6,
    },
    calendarioTopo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    setaMes: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    setaMesTexto: {
        color: '#2F6FED',
        fontSize: 20,
        fontWeight: 'bold',
    },
    mesAno: {
        color: '#F5F6F8',
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    diasSemanaLinha: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    diaSemanaTexto: {
        flex: 1,
        textAlign: 'center',
        color: '#8B929E',
        fontSize: 11,
        fontWeight: '600',
    },
    gradeDias: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    diaCelula: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        maxWidth: 48,  // trava o tamanho máximo da célula (evita "bolão" no PC)
        maxHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    diaCelulaAtiva: {
        backgroundColor: '#1B3A6B',
        borderRadius: 100,
        borderWidth: 1,
        borderColor: '#2F6FED',
    },
    diaTexto: {
        color: '#F5F6F8',
        fontSize: 13,
    },
    diaTextoAtivo: {
        color: '#F5F6F8',
        fontWeight: 'bold',
    },
    diaTextoLotado: {
        color: '#6B7280',
    },
    diaLotadoPonto: {
        position: 'absolute',
        bottom: 4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E0575A',
    },
    legendaLinha: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#20242C',
    },
    legendaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendaPontoLotado: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E0575A',
        marginRight: 8,
    },
    legendaTexto: {
        color: '#6B7280',
        fontSize: 11,
    },

    // Horários
    horariosLinha: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    horarioChip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#262A33',
        backgroundColor: '#15181E',
        marginRight: 10,
        marginBottom: 10,
        alignItems: 'center',
    },
    horarioChipAtivo: {
        backgroundColor: '#2F6FED',
        borderColor: '#2F6FED',
    },
    horarioChipOcupado: {
        backgroundColor: '#15181E',
        borderColor: '#262A33',
        opacity: 0.45,
    },
    horarioTexto: {
        color: '#F5F6F8',
        fontSize: 13,
        fontWeight: '600',
    },
    horarioTextoAtivo: {
        color: '#05060A',
    },
    horarioTextoOcupado: {
        color: '#8B929E',
        textDecorationLine: 'line-through',
    },
    horarioOcupadoLabel: {
        color: '#E0575A',
        fontSize: 9,
        marginTop: 2,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    semHorariosTexto: {
        color: '#E0575A',
        fontSize: 12,
        marginTop: 2,
    },

    // Campo de texto simples (WhatsApp)
    input: {
        backgroundColor: '#15181E',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#262A33',
        paddingVertical: 12,
        paddingHorizontal: 14,
        color: '#F5F6F8',
        fontSize: 14,
    },
    dicaTexto: {
        color: '#6B7280',
        fontSize: 11,
        marginTop: 8,
    },

    // Textarea de descrição
    textarea: {
        backgroundColor: '#15181E',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#262A33',
        padding: 14,
        color: '#F5F6F8',
        fontSize: 13,
        minHeight: 100,
        textAlignVertical: 'top',
    },

    // Upload de imagem de referência
    uploadBox: {
        backgroundColor: '#15181E',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#2F6FED',
        borderStyle: 'dashed',
        paddingVertical: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadTexto: {
        color: '#F5F6F8',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    uploadSubtexto: {
        color: '#8B929E',
        fontSize: 11,
    },

    // Prévia da imagem de referência escolhida
    previewBox: {
        backgroundColor: '#0D0F13',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#20242C',
        padding: 12,
        shadowColor: '#2F6FED',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 6,
    },
    previewImagem: {
        width: '100%',
        height: 200,
        borderRadius: 10,
        backgroundColor: '#15181E',
        marginBottom: 12,
    },
    previewAcoes: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    previewBotao: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: '#15181E',
        borderWidth: 1,
        borderColor: '#262A33',
        marginRight: 8,
    },
    previewBotaoRemover: {
        marginRight: 0,
        borderColor: '#E0575A',
    },
    previewBotaoTexto: {
        color: '#F5F6F8',
        fontSize: 12,
        fontWeight: '600',
    },

    // Botão final
    botaoConfirmar: {
        backgroundColor: '#1B3A6B',
        paddingVertical: 16,
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
    textoBotaoConfirmar: {
        color: '#F5F6F8',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 2,
    },

    // Mensagem de sucesso exibida na tela após confirmar o agendamento
    sucessoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 6, 10, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    sucessoCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#0D0F13',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2F6FED',
        paddingVertical: 28,
        paddingHorizontal: 24,
        alignItems: 'center',
        shadowColor: '#2F6FED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    sucessoIconeCirculo: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1B3A6B',
        borderWidth: 1,
        borderColor: '#2F6FED',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    sucessoIconeTexto: {
        color: '#2F6FED',
        fontSize: 26,
        fontWeight: '700',
    },
    sucessoTitulo: {
        color: '#F5F6F8',
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    sucessoDescricao: {
        color: '#F5F6F8',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 6,
    },
    sucessoDica: {
        color: '#8B929E',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 20,
    },
    sucessoBotao: {
        backgroundColor: '#2F6FED',
        paddingVertical: 10,
        paddingHorizontal: 32,
        borderRadius: 8,
    },
    sucessoBotaoTexto: {
        color: '#05060A',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 1,
    },
});