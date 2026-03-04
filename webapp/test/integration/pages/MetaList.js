sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'capstoneproject.custommasterdatamaintenance',
            componentId: 'MetaList',
            contextPath: '/Meta'
        },
        CustomPageDefinitions
    );
});