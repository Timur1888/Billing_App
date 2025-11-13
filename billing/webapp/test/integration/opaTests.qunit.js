/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["billing/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
