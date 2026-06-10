import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, AstroBarColors } from '@/constants/theme';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <ThemedText type="h4" style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );

  const Paragraph = ({ children }: { children: React.ReactNode }) => (
    <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
      {children}
    </ThemedText>
  );

  const BulletPoint = ({ children }: { children: string }) => (
    <View style={styles.bulletContainer}>
      <View style={[styles.bullet, { backgroundColor: AstroBarColors.primary }]} />
      <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
        {children}
      </ThemedText>
    </View>
  );

  const InfoBox = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
    <View style={[styles.infoBox, { backgroundColor: AstroBarColors.primary + '10' }]}>
      <View style={styles.infoHeader}>
        <Feather name={icon as any} size={20} color={AstroBarColors.primary} />
        <ThemedText type="body" style={[styles.infoTitle, { color: AstroBarColors.primary }]}>
          {title}
        </ThemedText>
      </View>
      {children}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Política de Privacidad</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.badge, { backgroundColor: AstroBarColors.success + '20' }]}>
          <Feather name="shield" size={16} color={AstroBarColors.success} />
          <ThemedText type="small" style={{ color: AstroBarColors.success, fontWeight: '600', marginLeft: Spacing.xs }}>
            Última actualización: Junio 2026
          </ThemedText>
        </View>

        <Section title="Nuestro Compromiso">
          <Paragraph>
            En AstroBar nos comprometemos a proteger su privacidad y salvaguardar sus datos personales. Esta política explica de manera transparente cómo recopilamos, utilizamos, almacenamos y protegemos su información de acuerdo con las leyes vigentes.
          </Paragraph>
        </Section>

        <Section title="Información que Recopilamos">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Al Registrarse:
          </ThemedText>
          <BulletPoint>Nombre completo o Razón Social</BulletPoint>
          <BulletPoint>Número de teléfono celular (verificado por SMS)</BulletPoint>
          <BulletPoint>Dirección de correo electrónico</BulletPoint>
          <BulletPoint>Contraseña de acceso (encriptada de forma irreversible)</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Durante el Uso de la Plataforma:
          </ThemedText>
          <BulletPoint>Ubicación geográfica por GPS (necesaria para localizar bares cercanos y gestionar el ruteo de promociones locales)</BulletPoint>
          <BulletPoint>Información transaccional y de facturación (procesada de forma segura por Mercado Pago)</BulletPoint>
          <BulletPoint>Historial de promociones escaneadas, validadas y canjes efectuados</BulletPoint>
          <BulletPoint>Datos técnicos del dispositivo (token de notificaciones push, modelo y sistema operativo)</BulletPoint>
        </Section>

        <Section title="Cómo Usamos su Información">
          <BulletPoint>Vincular de forma eficiente a los usuarios con los comercios gastronómicos locales</BulletPoint>
          <BulletPoint>Procesar los pagos de suscripciones y comisiones de manera encriptada</BulletPoint>
          <BulletPoint>Proporcionar geolocalización en tiempo real para el mapa dinámico de beneficios</BulletPoint>
          <BulletPoint>Enviar alertas inmediatas sobre promociones Flash activas en las cercanías</BulletPoint>
          <BulletPoint>Garantizar la seguridad del ecosistema y prevenir conductas fraudulentas</BulletPoint>
          <BulletPoint>Cumplir con las obligaciones fiscales y requerimientos legales del país</BulletPoint>
        </Section>

        <Section title="Compartir Información">
          <InfoBox icon="users" title="Con los Comercios Adheridos">
            <Paragraph>
              Al validar un código o promoción, compartimos únicamente los datos estrictamente necesarios para corroborar la transacción (como el nombre del cliente y el identificador dinámico de verificación QR).
            </Paragraph>
          </InfoBox>

          <InfoBox icon="server" title="Con Proveedores de Servicios">
            <Paragraph>
              Delegamos el procesamiento de pagos en Mercado Pago y el envío de validaciones en infraestructura cloud certificada. Todos nuestros proveedores operan bajo estrictos estándares de confidencialidad informática.
            </Paragraph>
          </InfoBox>
        </Section>

        <Section title="Seguridad de Datos">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Medidas Técnicas Implementadas:
          </ThemedText>
          <BulletPoint>Cifrado de canales de transferencia de datos mediante protocolos HTTPS/TLS</BulletPoint>
          <BulletPoint>Resguardo de contraseñas mediante algoritmos de hash criptográfico seguros (bcrypt)</BulletPoint>
          <BulletPoint>Cumplimiento normativo y tokenización provista por Mercado Pago</BulletPoint>
          <BulletPoint>Copias de seguridad automáticas y auditorías periódicas de bases de datos</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Su Responsabilidad:
          </ThemedText>
          <BulletPoint>Mantener credenciales robustas y no reutilizadas en otros portales</BulletPoint>
          <BulletPoint>No facilitar sus claves de acceso a terceros bajo ningún concepto</BulletPoint>
          <BulletPoint>Notificar de inmediato al soporte técnico ante cualquier actividad inusual</BulletPoint>
        </Section>

        <Section title="Sus Derechos Legales (Ley N° 25.326)">
          <Paragraph>
            De conformidad con la Ley de Protección de Datos Personales de la República Argentina, usted es titular de los derechos de Acceso, Rectificación, Actualización y Supresión de sus datos almacenados de forma totalmente gratuita.
          </Paragraph>
          <BulletPoint>Acceso: Solicitar informe detallado de sus datos registrados</BulletPoint>
          <BulletPoint>Rectificación/Actualización: Corregir datos erróneos o desactualizados</BulletPoint>
          <BulletPoint>Supresión: Solicitar la baja definitiva y eliminación de sus registros del sistema</BulletPoint>

          <View style={[styles.contactBox, { backgroundColor: theme.card }]}>
            <Feather name="mail" size={20} color={AstroBarColors.primary} />
            <View style={{ marginLeft: Spacing.md, flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: '600' }}>
                Canal de Derechos de Privacidad:
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                privacy@astrobar.app
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                Los plazos de resolución se rigen según los tiempos fijados por la AAIP.
              </ThemedText>
            </View>
          </View>
        </Section>

        <Section title="Retención de la Información">
          <BulletPoint>Perfil del usuario: Almacenado mientras la cuenta permanezca dada de alta</BulletPoint>
          <BulletPoint>Historial fiscal y contable: Conservado por los plazos de exigencia tributaria nacional</BulletPoint>
          <BulletPoint>Registros de localización GPS: Eliminados inmediatamente tras el cumplimiento del ruteo activo</BulletPoint>
        </Section>

        <Section title="Contacto y Soporte">
          <View style={[styles.contactGrid, { backgroundColor: theme.card }]}>
            <View style={styles.contactItem}>
              <Feather name="shield" size={24} color={AstroBarColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                Privacidad
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                privacy@astrobar.app
              </ThemedText>
            </View>
            <View style={styles.contactItem}>
              <Feather name="lock" size={24} color={AstroBarColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                Seguridad
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                security@astrobar.app
              </ThemedText>
            </View>
            <View style={styles.contactItem}>
              <Feather name="help-circle" size={24} color={AstroBarColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                Soporte
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                support@astrobar.app
              </ThemedText>
            </View>
          </View>
        </Section>

        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: '500' }}>
            AstroBar App - Conectando el sector gastronómico local con la comunidad urbana
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.xs }}>
             © 2026 AstroBar. Todos los derechos reservados de acuerdo al marco normativo vigente.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    fontWeight: '700',
  },
  subsectionTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  paragraph: {
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  bulletContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.md,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: Spacing.sm,
  },
  bulletText: {
    flex: 1,
    lineHeight: 22,
  },
  infoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoTitle: {
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  contactGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  contactItem: {
    alignItems: 'center',
    flex: 1,
  },
  footer: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});