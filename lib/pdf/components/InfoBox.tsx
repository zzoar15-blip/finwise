import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { pdfStyles } from '@/lib/pdf/styles';

export function InfoBox({
  text,
  variant,
}: {
  text: string;
  variant: 'info' | 'warning' | 'success';
}) {
  const boxStyle =
    variant === 'warning'
      ? pdfStyles.warningBox
      : variant === 'success'
      ? pdfStyles.successBox
      : pdfStyles.infoBox;
  const textStyle =
    variant === 'warning'
      ? pdfStyles.warningBoxText
      : variant === 'success'
      ? pdfStyles.successBoxText
      : pdfStyles.infoBoxText;
  return (
    <View style={boxStyle}>
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}

