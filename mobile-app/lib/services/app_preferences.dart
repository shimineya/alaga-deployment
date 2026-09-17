import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AppPreferences {
  AppPreferences._();

  static const _storage = FlutterSecureStorage();
  static const _dateFormatKey = 'ALAGA_DATE_FORMAT';
  static const _appearanceKey = 'ALAGA_APPEARANCE';
  static const _dataRefreshKey = 'ALAGA_DATA_REFRESH';
  static const _alertToneKey = 'ALAGA_ALERT_TONE';
  static const _alertVolumeKey = 'ALAGA_ALERT_VOLUME';

  static final ValueNotifier<String> dateFormat = ValueNotifier('MM/DD/YYYY');
  static final ValueNotifier<String> appearance = ValueNotifier('System Default');
  static final ValueNotifier<String> dataRefresh = ValueNotifier('Automatic');
  static final ValueNotifier<String> alertTone = ValueNotifier('System Default');
  static final ValueNotifier<double> alertVolume = ValueNotifier(1.0);

  static Future<void> load() async {
    dateFormat.value =
        await _storage.read(key: _dateFormatKey) ?? 'MM/DD/YYYY';
    appearance.value =
        await _storage.read(key: _appearanceKey) ?? 'System Default';
    dataRefresh.value =
        await _storage.read(key: _dataRefreshKey) ?? 'Automatic';
    alertTone.value =
        await _storage.read(key: _alertToneKey) ?? 'System Default';
    alertVolume.value = double.tryParse(
            await _storage.read(key: _alertVolumeKey) ?? '1.0') ??
        1.0;
  }

  static Future<void> save({
    required String dateFormatValue,
    required String appearanceValue,
    required String dataRefreshValue,
    required String alertToneValue,
    required double alertVolumeValue,
  }) async {
    dateFormat.value = dateFormatValue;
    appearance.value = appearanceValue;
    dataRefresh.value = dataRefreshValue;
    alertTone.value = alertToneValue;
    alertVolume.value = alertVolumeValue;
    await Future.wait([
      _storage.write(key: _dateFormatKey, value: dateFormatValue),
      _storage.write(key: _appearanceKey, value: appearanceValue),
      _storage.write(key: _dataRefreshKey, value: dataRefreshValue),
      _storage.write(key: _alertToneKey, value: alertToneValue),
      _storage.write(key: _alertVolumeKey, value: alertVolumeValue.toString()),
    ]);
  }
}
