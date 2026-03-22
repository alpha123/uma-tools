use strict;
use warnings;
use v5.012;
use utf8;

use DBI;
use DBD::SQLite::Constants qw(:file_open);
use JSON::PP;
use Encode qw(encode decode);

if (!@ARGV) {
	die 'Usage: make_global_skillnames.pl master.mdb';
}

my $mastermdb = shift @ARGV;

my $db = DBI->connect("dbi:SQLite:$mastermdb", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$db->{RaiseError} = 1;

my $select = $db->prepare('SELECT [index], text FROM text_data WHERE category = 47;');

$select->execute;

my ($id, $utf8name);

$select->bind_columns(\($id, $utf8name));

my %names;
while ($select->fetch) {
	my $name = Encode::decode('utf8', $utf8name);
	$names{$id} = [$name];
	if ($id =~ /^1(\d+)/) {  # add inherited versions of uniques
		$names{'9' . $1} = [$name . ' (inherited)'];
	}
}

my $json = JSON::PP->new;
$json->canonical(1);
$json->utf8(1);
say $json->encode(\%names);
