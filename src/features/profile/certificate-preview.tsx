import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  NativeModules,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useApp } from '../../core/app-context';
import { useRemote } from '../../core/hooks';
import { Button, ErrorBox, RemoteState, Txt, colors } from '../../core/ui';
import type { ProfileMedia } from './models';

type PdfDocument = { id: number; pages: number };
type CertificatePdfModule = {
  open(url: string): Promise<PdfDocument>;
  render(id: number, index: number): Promise<string>;
  close(id: number): void;
};

export function canPreviewCertificate(file: ProfileMedia) {
  return (
    file.url.startsWith('https://') &&
    (!file.expiresAt || Date.parse(file.expiresAt) > Date.now()) &&
    ['application/pdf', 'image/jpeg', 'image/png'].includes(file.contentType)
  );
}

export function CertificatePreview({
  file,
  onReload,
}: {
  file: ProfileMedia;
  onReload: () => void;
}) {
  const { t } = useApp();
  if (!canPreviewCertificate(file)) {
    return <ErrorBox error messageKey="certOpenFailed" retry={onReload} />;
  }
  const label = file.name || t('certFileFallback');
  return file.contentType === 'application/pdf' ? (
    <PdfPreview url={file.url} label={label} onReload={onReload} />
  ) : (
    <PreviewImage uri={file.url} label={label} onReload={onReload} />
  );
}

function PdfPreview({
  url,
  label,
  onReload,
}: {
  url: string;
  label: string;
  onReload: () => void;
}) {
  const { t } = useApp();
  const native = NativeModules.CareConnectCertificatePdf as CertificatePdfModule | undefined;
  const [document, setDocument] = useState<PdfDocument>();
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!native) return;
    let active = true;
    let opened: PdfDocument | undefined;
    native.open(url).then(
      (value) => {
        if (!active) {
          native.close(value.id);
          return;
        }
        opened = value;
        setDocument(value);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
      if (opened) native.close(opened.id);
    };
  }, [native, url]);

  const id = document?.id;
  const page = useRemote(
    useCallback(() => {
      if (!native || id === undefined) return Promise.resolve(undefined);
      return native.render(id, index);
    }, [native, id, index]),
  );
  if (!native) return <ErrorBox error messageKey="certPdfUnavailable" />;
  return (
    <RemoteState
      loading={!failed && (!document || page.loading)}
      error={failed || page.error ? new Error() : undefined}
      retry={onReload}
    >
      {page.data && <PreviewImage key={index} uri={page.data} label={label} onReload={onReload} />}
      {!!document && document.pages > 1 && (
        <View style={styles.controls}>
          <Button
            kind="secondary"
            label={t('certPreviousPage')}
            disabled={index === 0}
            onPress={() => setIndex(index - 1)}
          />
          <Txt accessibilityLiveRegion="polite">
            {index + 1} / {document.pages}
          </Txt>
          <Button
            kind="secondary"
            label={t('certNextPage')}
            disabled={index + 1 === document.pages}
            onPress={() => setIndex(index + 1)}
          />
        </View>
      )}
    </RemoteState>
  );
}

function PreviewImage({
  uri,
  label,
  onReload,
}: {
  uri: string;
  label: string;
  onReload: () => void;
}) {
  const { t } = useApp();
  const window = useWindowDimensions();
  const [ratio, setRatio] = useState(1);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  if (failed) return <ErrorBox error messageKey="certOpenFailed" retry={onReload} />;
  const imageWidth = (width || Math.min(window.width, 480)) * (zoom ? 2 : 1);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.preview}>
      {!loaded && <Txt muted>{t('loading')}</Txt>}
      <ScrollView horizontal scrollEnabled={zoom}>
        <Image
          accessibilityLabel={label}
          accessible
          onError={() => setFailed(true)}
          onLoad={({ nativeEvent: { source } }) => {
            if (source.width > 0 && source.height > 0) setRatio(source.width / source.height);
            setLoaded(true);
          }}
          resizeMode="contain"
          source={{ uri }}
          style={{ width: imageWidth, aspectRatio: ratio, backgroundColor: colors.white }}
        />
      </ScrollView>
      {loaded && (
        <Button
          kind="secondary"
          label={t(zoom ? 'certZoomOut' : 'certZoomIn')}
          onPress={() => setZoom(!zoom)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', gap: 8 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
