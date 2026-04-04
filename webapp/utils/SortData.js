sap.ui.define([
    "sap/ui/core/HTML",
    "sap/ui/model/Sorter"
], function(HTML, Sorter) {
    "use strict";

    return {
        onColumnSelect: function(oEvent) {
            oEvent.preventDefault();

            var oColumn = oEvent.getParameter("column");
            if (!oColumn) return;

            var iColIndex = oColumn.data("colIndex"); 
            var sColName = oColumn.data("colName"); 
            var that = this;

            var oTable = this.byId("dataTable") || this.byId("TablePage");
            var oBinding = oTable ? oTable.getBinding("rows") : null;
            var aSorters = oBinding ? oBinding.aSorters : [];
            
            var sCurrentSortKey = "none"; 
            var bIsGrouped = false; 

            if (aSorters && aSorters.length > 0) {
                var oCurrentSorter = aSorters.find(function(s) { return s.sPath === (iColIndex + "/value"); });
                if (oCurrentSorter) {
                    sCurrentSortKey = oCurrentSorter.bDescending ? "desc" : "asc";
                    bIsGrouped = !!oCurrentSorter.vGroup; 
                }
            }

            if (this._oColumnPopover) {
                this._oColumnPopover.destroy();
            }

            var oMultiSortCheckBox = new sap.m.CheckBox({
                text: "Multi-sort",
                selected: false
            });

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
                contentWidth: "250px", 
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
                                            var bMultiSort = oMultiSortCheckBox.getSelected();
                                            
                                            that.onSortColumnDirect(bDescending, iColIndex, bMultiSort, false); 
                                        },
                                        items: [
                                            new sap.m.SegmentedButtonItem({ icon: "sap-icon://sort-ascending", key: "asc", tooltip: "Ascending" }),
                                            new sap.m.SegmentedButtonItem({ icon: "sap-icon://sort-descending", key: "desc", tooltip: "Descending" })
                                        ]
                                    })
                                ]
                            }).addStyleClass("sapUiTinyMarginBottom"),

                            oMultiSortCheckBox.addStyleClass("sapUiSmallMarginBottom"),

                            new HTML({ content: "<hr style='border: 0; border-top: 1px solid #e5e5e5; margin: 10px 0;'/>" }),

                            new sap.m.Label({ text: "Group By", design: "Bold" }).addStyleClass("sapUiTinyMarginBottom"),
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                width: "100%",
                                items: [
                                    new sap.m.Text({ text: sColName }),
                                    new sap.m.Switch({
                                        state: bIsGrouped, 
                                        customTextOn: " ", customTextOff: " ",
                                        change: function(oEventSwitch) {
                                            var bState = oEventSwitch.getParameter("state");
                                            
                                            if (bState) {
                                                that.onSortColumnDirect(false, iColIndex, false, true);
                                                sap.m.MessageToast.show("Data grouped by: " + sColName);
                                            } else {
                                                var oTargetTable = that.byId("dataTable") || that.byId("TablePage");
                                                if (oTargetTable && oTargetTable.getBinding("rows")) {
                                                    oTargetTable.getBinding("rows").sort(null); 
                                                }
                                                sap.m.MessageToast.show("Group removed, data reset");
                                            }
                                        }
                                    })
                                ]
                            })
                        ]
                    }).addStyleClass("sapUiSmallMargin") 
                ]
            });

            this.getView().addDependent(this._oColumnPopover);
            this._oColumnPopover.openBy(oColumn.getLabel()); 
        },

        onSortColumnDirect: function(bDescending, iColIndex, bMultiSort, bGroup) {
            var oTable = this.byId("dataTable") || this.byId("TablePage");
            var oBinding = oTable ? oTable.getBinding("rows") : null;

            if (!oBinding) return;

            var sPath = iColIndex + "/value";
            
            var fnGroup = bGroup ? function(oContext) { return oContext.getProperty(sPath); } : false;
            var fnComparator = function(a, b) {
                if (a === b) return 0;
                if (a === null || a === undefined) return -1;
                if (b === null || b === undefined) return 1;
                
                var numA = parseFloat(a);
                var numB = parseFloat(b);
                
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                
                return a.toString().localeCompare(b.toString());
            };

            var oNewSorter = new Sorter(sPath, bDescending, fnGroup, fnComparator);
            var aFinalSorters = [];

            if (!bGroup) {
                if (bMultiSort) {
                    var aCurrentSorters = oBinding.aSorters || [];
                    aFinalSorters = aCurrentSorters.filter(function(oSorter) {
                        return oSorter.sPath !== sPath;
                    });

                    aFinalSorters.push(oNewSorter);
                } else {
                    aFinalSorters = [oNewSorter];
                }
            } else {
                aFinalSorters = [oNewSorter]; 
            }

            oBinding.sort(aFinalSorters);
        }
    };
});