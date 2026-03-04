sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"capstoneproject/custommasterdatamaintenance/test/integration/pages/MetaList",
	"capstoneproject/custommasterdatamaintenance/test/integration/pages/MetaObjectPage",
	"capstoneproject/custommasterdatamaintenance/test/integration/pages/DataObjectPage"
], function (JourneyRunner, MetaList, MetaObjectPage, DataObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('capstoneproject/custommasterdatamaintenance') + '/test/flp.html#app-preview',
        pages: {
			onTheMetaList: MetaList,
			onTheMetaObjectPage: MetaObjectPage,
			onTheDataObjectPage: DataObjectPage
        },
        async: true
    });

    return runner;
});

