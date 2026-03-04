sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("First journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();

            Then.onTheMetaList.iSeeThisPage();
            Then.onTheMetaList.onTable().iCheckColumns(5, {"fieldname":{"header":"Field Name"},"table_name":{"header":"Table Name"},"field_pos":{"header":"Table position"},"rollname":{"header":"Data element"},"datatype":{"header":"Data Type"}});

        });


        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data
            
            When.onTheMetaList.onFilterBar().iExecuteSearch();
            
            Then.onTheMetaList.onTable().iCheckRows();

            When.onTheMetaList.onTable().iPressRow(0);
            Then.onTheMetaObjectPage.iSeeThisPage();

        });

        opaTest("Teardown", function (Given, When, Then) { 
            // Cleanup
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});