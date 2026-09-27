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
  static const _hrMinKey = 'ALAGA_HR_MIN';
  static const _hrMaxKey = 'ALAGA_HR_MAX';
  static const _tempMinKey = 'ALAGA_TEMP_MIN';
  static const _tempMaxKey = 'ALAGA_TEMP_MAX';
  static const _spo2MinKey = 'ALAGA_SPO2_MIN';

  static final ValueNotifier<String> dateFormat = ValueNotifier('MM/DD/YYYY');
  static final ValueNotifier<String> appearance = ValueNotifier('System Default');
  static final ValueNotifier<String> dataRefresh = ValueNotifier('Automatic');
  static final ValueNotifier<String> alertTone = ValueNotifier('System Default');
  static final ValueNotifier<double> alertVolume = ValueNotifier(1.0);

  // Safety net thresholds
  static final ValueNotifier<double> hrMin = ValueNotifier(50.0);
  static final ValueNotifier<double> hrMax = ValueNotifier(120.0);
  static final ValueNotifier<double> tempMin = ValueNotifier(36.0);
  static final ValueNotifier<double> tempMax = ValueNotifier(37.5);
  static final ValueNotifier<double> spo2Min = ValueNotifier(90.0);

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

    hrMin.value = double.tryParse(await _storage.read(key: _hrMinKey) ?? '50.0') ?? 50.0;
    hrMax.value = double.tryParse(await _storage.read(key: _hrMaxKey) ?? '120.0') ?? 120.0;
    tempMin.value = double.tryParse(await _storage.read(key: _tempMinKey) ?? '36.0') ?? 36.0;
    tempMax.value = double.tryParse(await _storage.read(key: _tempMaxKey) ?? '37.5') ?? 37.5;
    spo2Min.value = double.tryParse(await _storage.read(key: _spo2MinKey) ?? '90.0') ?? 90.0;
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

  static Future<void> saveSafetyThresholds({
    required double hrMinValue,
    required double hrMaxValue,
    required double tempMinValue,
    required double tempMaxValue,
    required double spo2MinValue,
  }) async {
    hrMin.value = hrMinValue;
    hrMax.value = hrMaxValue;
    tempMin.value = tempMinValue;
    tempMax.value = tempMaxValue;
    spo2Min.value = spo2MinValue;
    await Future.wait([
      _storage.write(key: _hrMinKey, value: hrMinValue.toString()),
      _storage.write(key: _hrMaxKey, value: hrMaxValue.toString()),
      _storage.write(key: _tempMinKey, value: tempMinValue.toString()),
      _storage.write(key: _tempMaxKey, value: tempMaxValue.toString()),
      _storage.write(key: _spo2MinKey, value: spo2MinValue.toString()),
    ]);
  }
}
