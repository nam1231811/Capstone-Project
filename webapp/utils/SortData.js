sap.ui.define([
    "sap/ui/core/HTML",
    "sap/ui/model/Sorter"
], function(HTML, Sorter) {
    "use strict";

    return {
        onColumnHeaderPress: function(oEvent) {
            var oButton = oEvent.getSource(); 
            var iColIndex = oButton.data("colIndex"); 
            var sColName = oButton.data("colName"); 
            var that = this;

            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("rows");
            var aSorters = oBinding ? oBinding.aSorters : [];
            
            var sCurrentSortKey = "none"; 
            if (aSorters && aSorters.length > 0) {
                var oCurrentSorter = aSorters[0];
                if (oCurrentSorter.sPath === (iColIndex + "/value")) {
                    sCurrentSortKey = oCurrentSorter.bDescending ? "desc" : "asc";
                }
            }

            if (this._oColumnPopover) {
                this._oColumnPopover.destroy();
            }

            this._oColumnPopover = new sap.m.ResponsivePopover({
                showHeader: true,
                customHeader: new sap.m.Bar({
                    contentMiddle: [
                        new sap.m.Title({ text: "Column Settings" })
                    ],
                    contentRight: [
                        new sap.m.Button({
                            icon: "sap-icon://decline",
                            type: "Transparent",
                            press: function() {
                                that._oColumnPopover.close();
                            }
                        })
                    ]
                }),
                contentWidth: "220px", 
                placement: "Bottom",
                content: [
                    new sap.m.VBox({
                        items: [
                            new sap.m.Label({ text: "Sort By", design: "Bold" }).addStyleClass("sapUiTinyMarginBottom"),
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween", 
                                alignItems: "Center",
                                width: "100%",
                                items: [
                                    new sap.m.Text({ text: sColName }), 
                                    new sap.m.SegmentedButton({
                                        selectedKey: sCurrentSortKey,
                                        selectionChange: function(oEventSelect) {
                                            var oItem = oEventSelect.getParameter("item");
                                            var sKey = oItem ? oItem.getKey() : oEventSelect.getSource().getSelectedKey();
                                            var bDescending = (sKey === "desc");
                                            
                                            that.onSortColumnDirect(bDescending, iColIndex);
                                        },
                                        items: [
                                            new sap.m.SegmentedButtonItem({ icon: "sap-icon://sort-ascending", key: "asc", tooltip: "Ascending" }),
                                            new sap.m.SegmentedButtonItem({ icon: "sap-icon://sort-descending", key: "desc", tooltip: "Descending" })
                                        ]
                                    })
                                ]
                            }).addStyleClass("sapUiSmallMarginBottom"),

                            new HTML({ content: "<hr style='border: 0; border-top: 1px solid #e5e5e5; margin: 10px 0;'/>" }),

                            new sap.m.Label({ text: "Group By", design: "Bold" }).addStyleClass("sapUiTinyMarginBottom"),
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                width: "100%",
                                items: [
                                    new sap.m.Text({ text: sColName }),
                                    new sap.m.Switch({
                                        state: false,
                                        customTextOn: " ", customTextOff: " ",
                                        change: function(oEventSwitch) {
                                            sap.m.MessageToast.show("Group By function is under development.");
                                        }
                                    })
                                ]
                            })
                        ]
                    }).addStyleClass("sapUiSmallMargin") 
                ]
            });

            this.getView().addDependent(this._oColumnPopover);
            this._oColumnPopover.openBy(oButton);
        },

        onSortColumnDirect: function(bDescending, iColIndex) {
            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("rows");

            if (!oBinding) return;

            var sPath = iColIndex + "/value";
            
            var oSorter = new Sorter({
                path: sPath,
                descending: bDescending,
                comparator: function(a, b) {
                    if (a === b) return 0;
                    if (a === null || a === undefined) return -1;
                    if (b === null || b === undefined) return 1;
                    
                    var numA = parseFloat(a);
                    var numB = parseFloat(b);
                    
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    
                    return a.toString().localeCompare(b.toString());
                }
            });

            oBinding.sort([oSorter]);
        }
    };
});