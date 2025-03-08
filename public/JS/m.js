var modal = document.getElementById("myModal");
        var openModalBtn = document.getElementById("openModalBtn");
        var closeBtn = document.getElementsByClassName("close")[0];
        var tableBody = document.querySelector(".entryDataa tbody");
        const regNo = document.getElementById('reg_no').value;

          
        openModalBtn.onclick = function() {
            modal.style.display = "block";
            
            // Fetch data from the /entry/misc/view API
            fetch(`/entry/misc/activity/view?reg_no=${regNo}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        updateTable(data.data);  // Update the table with the fetched data
                    } else {
                        alert("Failed to load data.");
                    }
                })
                .catch(error => {
                    console.error("Error fetching data:", error);
                    alert("An error occurred while fetching data.");
                });
        }
    
        // Close the modal
        closeBtn.onclick = function() {
            modal.style.display = "none";
        }
    
        // Close the modal if the user clicks anywhere outside the modal
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }
    
        // Function to update the table with the fetched data
        function updateTable(data) {
            // Clear existing table rows
            tableBody.innerHTML = '';
        
            // Loop through the data and add rows to the table
            data.forEach(item => {
                var newRow = document.createElement("tr");
        
                // Split the date_time into Date and Time
                var dateTime = new Date(item.date_time);
                var formattedDate = dateTime.getDate().toString().padStart(2, '0') + '-' +
                                    (dateTime.getMonth() + 1).toString().padStart(2, '0') + '-' +
                                    dateTime.getFullYear();
                var formattedTime = dateTime.getHours().toString().padStart(2, '0') + ':' +
                                    dateTime.getMinutes().toString().padStart(2, '0') + ':' +
                                    dateTime.getSeconds().toString().padStart(2, '0');
        
                // Insert new cells into the row for Date, Time, User, Post, and Remark
                newRow.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td>${item.user}</td>
                    <td>${item.post}</td>
                    <td>${item.remark}</td>
                `;
        
                // Append the new row to the table
                tableBody.appendChild(newRow);
            });
        }