import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, AstroBarColors } from '@/constants/theme';

export default function TermsScreen() {
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

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Términos y Condiciones</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.badge, { backgroundColor: AstroBarColors.primary + '20' }]}>
          <ThemedText type="small" style={{ color: AstroBarColors.primary, fontWeight: '600' }}>
            Última actualización: Junio 2026
          </ThemedText>
        </View>

        <Section title="1. Aceptación de los Términos">
          <Paragraph>
            Al acceder y utilizar AstroBar, usted acepta estar legalmente vinculado por estos Términos y Condiciones. 
            AstroBar es una plataforma tecnológica que conecta usuarios con bares nocturnos mediante promociones flash y comunes en Buenos Aires, Argentina.
          </Paragraph>
        </Section>

        <Section title="2. Servicios de la Plataforma">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Para Usuarios/Clientes:
          </ThemedText>
          <BulletPoint>Explorar bares nocturnos en Buenos Aires</BulletPoint>
          <BulletPoint>Acceder a promociones flash (5-15 minutos de disponibilidad)</BulletPoint>
          <BulletPoint>Aceptar promociones comunes programadas</BulletPoint>
          <BulletPoint>Sistema de puntos y niveles (Copper a Platinum)</BulletPoint>
          <BulletPoint>Códigos QR únicos para canjear en la barra del bar</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Para Bares y Comercios:
          </ThemedText>
          <BulletPoint>Panel de gestión de promociones en tiempo real</BulletPoint>
          <BulletPoint>Control de menú, stock e insumos disponibles</BulletPoint>
          <BulletPoint>Estadísticas analíticas de ventas y canjes efectuados</BulletPoint>
          <BulletPoint>Comisión progresiva: Mes 1 bonificado (gratis), Mes 2: 5%, Mes 3: 10%, Mes 4 en adelante: 15%</BulletPoint>
          <BulletPoint>El bar recibe el 100% del precio fijado por el producto</BulletPoint>
        </Section>

        <Section title="3. Sistema de Pagos y Comisiones">
          <Paragraph>
            Por cada promoción aceptada dentro de la plataforma, la distribución se efectúa de la siguiente manera:
          </Paragraph>
          <BulletPoint>Bar: Percibe el 100% del precio estipulado para el producto promocional</BulletPoint>
          <BulletPoint>AstroBar: Comisión progresiva adicional que abona el usuario por el uso del servicio</BulletPoint>
          <BulletPoint>Primer mes: 0% (periodo de prueba bonificado para nuevos bares)</BulletPoint>
          <BulletPoint>Segundo mes: 5% adicional sobre el valor del consumo</BulletPoint>
          <BulletPoint>Tercer mes: 10% adicional sobre el valor del consumo</BulletPoint>
          <BulletPoint>Cuarto mes en adelante: 15% de recargo por servicio digital</BulletPoint>
          <Paragraph>
            Los pagos se procesan de forma encriptada mediante la pasarela segura de Mercado Pago. Tras aceptar la oferta, el usuario dispone de una ventana de 60 segundos para efectuar la cancelación si lo requiere.
          </Paragraph>
        </Section>

        <Section title="4. Cancelaciones y Política de Uso">
          <BulletPoint>Cancelación efectuada dentro de los 60 segundos: Reembolso completo del 100%</BulletPoint>
          <BulletPoint>Pasados los 60 segundos iniciales: No aplica reembolso de ningún tipo</BulletPoint>
          <BulletPoint>Los códigos QR de canje son intransferibles y de un único uso por transacción</BulletPoint>
          <BulletPoint>Las promociones flash tienen una duración estrictamente limitada (de 5 a 15 minutos en radar)</BulletPoint>
          <BulletPoint>Cada oferta lanzada al mapa cuenta con un cupo de stock limitado predefinido por el comercio</BulletPoint>
        </Section>

        <Section title="5. Sistema de Puntos y Niveles">
          <Paragraph>
            Los usuarios adquieren 10 puntos de experiencia por cada promoción QR validada exitosamente en caja. Los rangos de niveles del perfil se distribuyen en:
          </Paragraph>
          <BulletPoint>Copper: de 0 a 99 puntos acumulados</BulletPoint>
          <BulletPoint>Bronze: de 100 a 249 puntos acumulados</BulletPoint>
          <BulletPoint>Silver: de 250 a 499 puntos acumulados</BulletPoint>
          <BulletPoint>Gold: de 500 a 999 puntos acumulados</BulletPoint>
          <BulletPoint>Platinum: 1000 o más puntos acumulados en la cuenta</BulletPoint>
        </Section>

        <Section title="6. Privacidad y Datos">
          <Paragraph>
            Recopilamos la información estrictamente necesaria para la correcta prestación del servicio: nombre, teléfono de contacto, localización por GPS en tiempo real (únicamente durante el uso activo de la app) e historial de canjes. Consulte nuestra Política de Privacidad integrada para más detalles.
          </Paragraph>
        </Section>

        <Section title="7. Limitación de Responsabilidad">
          <Paragraph>
            AstroBar opera exclusivamente como una plataforma tecnológica de intermediación entre los usuarios finales y los establecimientos comerciales adheridos. No asumimos responsabilidad alguna sobre la calidad, el estado, la higiene de los productos o las acciones particulares del personal de los bares participantes. El servicio se brinda "tal cual está" sin garantías de disponibilidad técnica ininterrumpida. Todo usuario debe contar con la mayoría de edad legal (18 años o más).
          </Paragraph>
        </Section>

        <Section title="8. Conducta Prohibida">
          <Paragraph>
            Queda estrictamente prohibido utilizar la plataforma para fines ilícitos, falsificar identidades, generar múltiples cuentas espejo con el fin de eludir los límites de stock de las promociones, revender de forma externa los códigos QR asignados o ejercer cualquier tipo de hostigamiento hacia los comercios. La detección de estas faltas conllevará la suspensión permanente de la cuenta sin derecho a reclamos.
          </Paragraph>
        </Section>

        <Section title="9. Modificaciones">
          <Paragraph>
            AstroBar se reserva el derecho de modificar o actualizar estos términos en cualquier momento. Los cambios sustanciales serán notificados a la comunidad mediante la aplicación o por correo electrónico. El uso continuado del sistema implica la aceptación lisa y llana de las nuevas condiciones.
          </Paragraph>
        </Section>

        <Section title="10. Contacto">
          <Paragraph>
            E-mail institucional: support@astrobar.app{'\n'}
            Ubicación de cabecera: Buenos Aires, Argentina{'\n'}
            Mesa de soporte técnico disponible de forma integrada en la app.
          </Paragraph>
        </Section>

        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: '500' }}>
            AstroBar - Conectando el circuito gastronómico y nocturno en Buenos Aires
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.xs }}>
             © 2026 AstroBar. Todos los derechos reservados.
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
  footer: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});