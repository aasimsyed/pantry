import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';
import type { FlavorPairing } from '../types';

interface FlavorChemistrySheetProps {
  visible: boolean;
  onDismiss: () => void;
  flavorPairings: FlavorPairing[];
  recipeName?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Utility function to remove duplicate brand names from ingredient names
const cleanIngredientName = (name: string): string => {
  if (!name || typeof name !== 'string') return name;
  
  // Split into words
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return name;
  
  // Check if first word(s) are repeated (common pattern: "Brand Brand Product Name")
  // Try matching 1-3 words at the start
  for (let wordCount = 1; wordCount <= Math.min(3, Math.floor(words.length / 2)); wordCount++) {
    const firstPart = words.slice(0, wordCount).join(' ');
    const secondPart = words.slice(wordCount, wordCount * 2).join(' ');
    
    // Case-insensitive comparison
    if (firstPart.toLowerCase() === secondPart.toLowerCase()) {
      // Found duplicate! Remove the first occurrence
      return words.slice(wordCount).join(' ');
    }
  }
  
  return name;
};

export function FlavorChemistrySheet({
  visible,
  onDismiss,
  flavorPairings,
  recipeName,
}: FlavorChemistrySheetProps) {
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);

  if (!flavorPairings || flavorPairings.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onDismiss}>
          <View style={styles.dismissArea} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: ds.colors.surface,
              ...ds.shadows.lg,
            },
          ]}
        >
                {/* Handle bar */}
                <View style={styles.handleContainer}>
                  <View
                    style={[
                      styles.handle,
                      { backgroundColor: ds.colors.surfaceHover },
                    ]}
                  />
                </View>

                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerContent}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: `${ds.colors.accent}15` },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="flask-outline"
                        size={28}
                        color={ds.colors.accent}
                      />
                    </View>
                    <View style={styles.headerText}>
                      <Text
                        style={[
                          styles.headerTitle,
                          { color: ds.colors.textPrimary },
                        ]}
                      >
                        Why This Works
                      </Text>
                      <Text
                        style={[
                          styles.headerSubtitle,
                          { color: ds.colors.textSecondary },
                        ]}
                      >
                        The flavor science behind your recipe
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onDismiss}
                    style={[
                      styles.closeButton,
                      { backgroundColor: ds.colors.surfaceHover },
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={20}
                      color={ds.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView
                  style={styles.content}
                  contentContainerStyle={styles.contentContainer}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  nestedScrollEnabled={true}
                >
                  {flavorPairings.map((pairing, index) => (
                    <View
                      key={index}
                      style={[
                        styles.pairingCard,
                        {
                          backgroundColor: ds.colors.background,
                          borderLeftColor: ds.colors.accent,
                        },
                      ]}
                    >
                      {/* Ingredients */}
                      <View style={styles.ingredientsRow}>
                        {pairing.ingredients.map((ingredient, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && (
                              <View
                                style={[
                                  styles.plusIcon,
                                  { backgroundColor: `${ds.colors.primary}15` },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="plus"
                                  size={12}
                                  color={ds.colors.primary}
                                />
                              </View>
                            )}
                            <View
                              style={[
                                styles.ingredientChip,
                                { backgroundColor: `${ds.colors.primary}10` },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.ingredientText,
                                  { color: ds.colors.primary },
                                ]}
                              >
                                {cleanIngredientName(ingredient)}
                              </Text>
                            </View>
                          </React.Fragment>
                        ))}
                      </View>

                      {/* Shared Compounds */}
                      <View style={styles.compoundsSection}>
                        <View style={styles.compoundsHeader}>
                          <MaterialCommunityIcons
                            name="molecule"
                            size={16}
                            color={ds.colors.accent}
                          />
                          <Text
                            style={[
                              styles.compoundsLabel,
                              { color: ds.colors.textSecondary },
                            ]}
                          >
                            Shared Compounds
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.compoundsText,
                            { color: ds.colors.textPrimary },
                          ]}
                        >
                          {pairing.compounds}
                        </Text>
                      </View>

                      {/* Effect */}
                      <View
                        style={[
                          styles.effectSection,
                          { backgroundColor: `${ds.colors.success}08` },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="lightbulb-outline"
                          size={18}
                          color={ds.colors.success}
                        />
                        <Text
                          style={[
                            styles.effectText,
                            { color: ds.colors.textPrimary },
                          ]}
                        >
                          {pairing.effect}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {/* Footer info */}
                  <View style={styles.footer}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={14}
                      color={ds.colors.textTertiary}
                    />
                    <Text
                      style={[
                        styles.footerText,
                        { color: ds.colors.textTertiary },
                      ]}
                    >
                      Based on flavor compound analysis and culinary science
                    </Text>
                  </View>
                </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    height: SCREEN_HEIGHT * 0.75,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 80, // Extra padding for safe area
  },
  pairingCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
  },
  ingredientsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  ingredientChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexShrink: 1,
  },
  ingredientText: {
    fontSize: 13,
    fontWeight: '600',
    flexWrap: 'wrap',
  },
  plusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compoundsSection: {
    marginBottom: 12,
  },
  compoundsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  compoundsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compoundsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  effectSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  effectText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
  },
});
